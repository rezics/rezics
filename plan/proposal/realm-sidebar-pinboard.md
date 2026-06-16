---
title: Realm sidebar widgets and first-class Pinboards
status: applied
created: 2026-06-16
completed: 2026-06-16
supersededBy:
tags: [contract, server, app, realm, pinboard, sidebar]
---

## Why
Realm customization currently accumulates unrelated concerns in `Realm.extra`.
The same JSON bag stores profile chrome (`avatar`, `banner`), posting and tag
preferences (`tagTree`, `tagView`, `defaultLicenseSlug`), rule/about content
references, weak zone links, wiki sidebar configuration, and ordered pinboard
lists. Zone feels cleaner because its independently editable concerns are named
fields (`boundary`, `nav`, `theme`, `pages`) with typed contracts.

This change makes the two composed realm surfaces explicit. Sidebar widgets
become a contract-owned, versioned `Realm.sidebar` envelope grouped by placement
(`home`, `wiki`, `about`). Pinboards become first-class ordered Unit-reference
lists backed by tables and a Pinboard API. The old `announcement` list is
deleted: it has no distinct content model, and homepage announcement UI can
render the default realm's normal home pinboard.

## Durable constraints & decisions
- (type) Realm sidebar configuration lives in
  `package/contract/src/realm/realm-sidebar.ts` as a versioned envelope:
  `schema: "rezics/realm-sidebar"`, `version: 1`, and `placements` keyed by
  `home`, `wiki`, and `about`.
- (type) Each sidebar placement owns its own ordered `RealmSidebarWidget[]`.
  A widget does not implicitly appear on multiple placements.
- (type) `surface` is not used in the public contract vocabulary. The contract
  calls the page/slot key a `placement`.
- (type) Moderator-authored short text in widgets uses LABEL Unit references:
  `titleLabelUnitId`, `labelUnitId`, and `altLabelUnitId`. Widget config must
  not contain inline display strings for custom user-facing text.
- (type) Long custom widget content uses content Unit references, not inline
  markdown or app i18n strings. The initial `text` widget references a content
  Unit through `contentUnitId`.
- (type) App i18n remains only for product chrome and built-in fallback labels,
  such as editor button labels and default widget kind labels.
- (type) Sidebar v1 widget kinds are deliberately small and map to current
  product needs: `text`, `rules`, `buttons`, `images`, `communityList`,
  `calendar`, `featuredZone`, `zoneNav`, `stats`, and `pinboard`.
- (type) Sidebar widgets may reference a Pinboard by key. They do not own or
  duplicate Pinboard entries.
- (type) Pinboard is a first-class model, not a `Realm.extra` list. Its contract
  lives in `package/contract/src/pinboard/pinboard.ts`.
- (type) Pinboard `kind` describes rendering mode. V1 only supports
  `kind: "list"` and the management UI does not expose it as a setting.
- (type) Pinboard purpose is represented by `key`, not by `kind`. V1 reserves
  `key: "home"` as the realm home pinboard. There is no `announcement` key in
  the durable model.
- (test) Homepage announcement/notice UI reads the default realm home Pinboard.
  No contract, server route, API key, or app query may depend on
  `announcement`.
- (test) A realm can have at most one Pinboard per `(realmUnitId, key)`.
- (test) Pinboard reads preserve stored entry order, public reads filter out
  entries not visible to the caller, and admin reads expose stale entries.
- (test) Pinboard reorder rejects non-permutations of the current entry set.
- (comment) Pinboard entries are Unit references. The Pinboard domain controls
  ordering and visibility filtering; individual entry rendering stays a
  presentation concern owned by the consuming app section.
- (comment) `Realm.ruleUnitId` is part of realm governance/policy, not just a
  sidebar widget. The `rules` widget renders the configured realm rule policy
  rather than storing a second rule content reference.

## 1. Contract Shape
- [x] 1.1 Add `package/contract/src/realm/realm-sidebar.ts` with
  `realmSidebarPlacementSchema`, `realmSidebarWidgetSchema`,
  `realmSidebarV1Schema`, parser helpers, and exported TypeScript types.
- [x] 1.2 Define sidebar widget variants:
  `text`, `rules`, `buttons`, `images`, `communityList`, `calendar`,
  `featuredZone`, `zoneNav`, `stats`, and `pinboard`.
- [x] 1.3 Use LABEL references for widget-authored short text:
  widget `titleLabelUnitId`, button `labelUnitId`, image `altLabelUnitId`,
  collection labels where applicable.
- [x] 1.4 Use content/Unit references for long or entity-backed widget data:
  `contentUnitId`, `realmUnitIds`, `zoneUnitId`, `menuId`, and `pinboardKey`.
- [x] 1.5 Add contract tests in
  `package/contract/src/realm/realm-sidebar.test.ts` for valid placements,
  valid widget variants, rejected inline text fields, and rejected unknown
  widget kinds.
- [x] 1.6 Add `package/contract/src/pinboard/pinboard.ts` and
  `package/contract/src/pinboard/index.ts` with `PinboardKind`,
  `PinboardKey`, DTOs, path params, read/admin-read responses, append/reorder
  bodies, and ok responses.
- [x] 1.7 Add contract tests in
  `package/contract/src/pinboard/pinboard.test.ts` locking `kind: "list"`,
  `key: "home"`, ordered Unit entry shape, and absence of any `announcement`
  literal.
- [x] 1.8 Export new sidebar and pinboard contracts from
  `package/contract/src/realm/index.ts` and `package/contract/src/index.ts`.
- [x] 1.9 Remove `pinboard`, `announcement`, `featuredZoneUnitId`, and
  `wikiSidebar` from `realmExtraSchema`. Keep only extra values that are still
  profile/settings concerns until those get their own follow-up migration.
- [x] 1.10 Move the rule content pointer out of `Realm.extra.rule` at the
  contract level by adding an explicit nullable rule reference to the realm
  rule policy DTOs.

## 2. Database and Server Model
- [x] 2.1 Update `package/server/src/db/schema/realm.ts` to add a typed
  `sidebar` JSON column for the `RealmSidebar` envelope.
- [x] 2.2 Add an explicit nullable `ruleUnitId` column to `Realm`, tied to the
  existing rule version and rule requirement columns.
- [x] 2.3 Add Pinboard tables in an appropriate schema file:
  `Pinboard(id, realmUnitId, key, kind, createdAt, updatedAt)` and
  `PinboardEntry(pinboardId, unitId, position, createdAt, updatedAt)`.
- [x] 2.4 Add database indexes and constraints:
  unique `(realmUnitId, key)`, unique `(pinboardId, unitId)`, and ordered lookup
  on `(pinboardId, position, unitId)`.
- [x] 2.5 Generate Drizzle migrations from schema changes. Do not hand-author
  ordinary generated SQL.
- [x] 2.6 Update realm mapping in `package/server/src/realm/realm.mapper.ts`
  and related service reads so `RealmDTO` includes `sidebar` and the explicit
  rule policy reference.
- [x] 2.7 Remove server-side reads of `Realm.extra.pinboard`,
  `Realm.extra.announcement`, `Realm.extra.featuredZoneUnitId`,
  `Realm.extra.wikiSidebar`, and `Realm.extra.rule`.
- [x] 2.8 Update seed/factory code to create the default realm home Pinboard
  and Pinboard entries instead of writing `Realm.extra.pinboard` or
  `Realm.extra.announcement`.

## 3. Pinboard Server API
- [x] 3.1 Add a Pinboard service domain under `package/server/src/pinboard/`
  with `{domain}.service.ts`, `.api.ts`, `.mapper.ts`, and `.types.ts`.
- [x] 3.2 Implement public read for `GET /realm/:unitId/pinboards/:key`:
  resolve the Pinboard, return ordered Unit IDs, and filter out entries not
  visible to the caller.
- [x] 3.3 Implement admin read for
  `GET /realm/:unitId/pinboards/:key/admin`: require realm content pin
  authority and return ordered Unit IDs plus stale IDs.
- [x] 3.4 Implement append, remove, and reorder routes for Pinboard entries.
  Appends are idempotent; reorder must be a permutation of current entries.
- [x] 3.5 Preserve the existing content pin policy behavior for Pinboard
  mutation authority, but target IDs should use the new Pinboard identity
  rather than `realmId:key` extra-list strings.
- [x] 3.6 Mount the Pinboard API from `package/server/src/index.ts`.
- [x] 3.7 Delete the legacy `/:unitId/announcements` routes from
  `package/server/src/realm/realm.api.ts`.
- [x] 3.8 Delete or shrink `package/server/src/realm/realm-extra.api.ts` and
  `realm-extra.service.ts` so they no longer expose ordered-list primitives.
- [ ] 3.9 Add focused server tests for Pinboard read filtering, admin stale
  reads, append idempotency, remove idempotency, reorder conflict rejection,
  and absence of announcement routes.

## 4. Realm Sidebar Server API
- [x] 4.1 Add `package/server/src/realm/realm-sidebar.service.ts` for loading
  and updating the `Realm.sidebar` envelope with realm manage authority.
- [x] 4.2 Validate every LABEL reference points to a live LABEL Unit where the
  widget requires custom short text.
- [x] 4.3 Validate widget content references by shape and intended target:
  content widgets require content Unit IDs, community lists require Realm Unit
  IDs, zone widgets require Zone Unit IDs, and Pinboard widgets reference a
  Pinboard key.
- [x] 4.4 Keep weak-link rendering semantics where appropriate: unresolved
  optional widget targets should degrade at read/render time rather than making
  the whole sidebar unreadable.
- [x] 4.5 Add API routes for reading and updating the full sidebar envelope.
  If partial placement updates are added, they must update one placement without
  overwriting concurrent edits to other placements.
- [ ] 4.6 Add server tests for sidebar schema validation, LABEL enforcement,
  placement isolation, and authority checks.

## 5. API Package
- [x] 5.1 Add `package/api/src/pinboard/` with `pinboard.api.ts`,
  `pinboard.keys.ts`, `pinboard.queries.ts`, `pinboard.mutations.ts`, and
  `index.ts`.
- [x] 5.2 Replace `realm-extra` list query/mutation consumers with Pinboard
  query/mutation hooks.
- [x] 5.3 Add realm sidebar query/mutation helpers under `package/api/src/realm/`
  or a dedicated `realm-sidebar` folder, matching the server route naming.
- [x] 5.4 Remove exported `announcement` list key types and API helpers from
  `package/api/src/realm/realm-extra.*`.
- [ ] 5.5 Update API tests to cover Pinboard routes and to ensure
  announcement-specific API calls are gone.

## 6. App Pinboard Cutover
- [x] 6.1 Update `package/app/src/pinboard/models/types.ts` so
  `PinboardListKey` comes from the new Pinboard contract and only uses
  `key: "home"` for the current product surface.
- [x] 6.2 Update `package/app/src/pinboard/hooks/usePinboard.ts` to read from
  Pinboard APIs instead of `realmExtraReadQuery` and
  `realmExtraAdminReadQuery`.
- [x] 6.3 Update `PinboardReorderList`, `StaleIdsBanner`, and
  `PinboardAdminSection` to use Pinboard mutations instead of realm-extra
  mutations.
- [x] 6.4 Remove the announcement tab from `PinboardAdminSection`; the admin UI
  manages only the realm home Pinboard in v1.
- [x] 6.5 Replace `AnnouncementStreamSection` with a more honest data source
  name, or keep only a presentation wrapper that internally reads the default
  realm home Pinboard. It must not pass `pinboardKey: "announcement"`.
- [x] 6.6 Update `AnnouncementBarSection` and `NoticeBoard` so homepage
  announcement presentation renders entries from the default realm home
  Pinboard.
- [x] 6.7 Update `PinnedStreamSection` to read the current realm home Pinboard.
- [x] 6.8 Remove all app references to the `announcement` key.

## 7. App Realm Sidebar Cutover
- [x] 7.1 Add a sidebar renderer in `package/app/src/realm/sections/` or
  `package/app/src/realm/components/` that accepts a placement and renders the
  ordered `RealmSidebarWidget[]`.
- [x] 7.2 Replace hard-coded stream sidebar composition in
  `RealmStreamTab.tsx` with the `home` placement renderer.
- [x] 7.3 Replace hard-coded wiki sidebar logic in `RealmWikiTab.tsx` with the
  `wiki` placement renderer.
- [x] 7.4 Replace the about tab right column with the `about` placement
  renderer.
- [x] 7.5 Add widget renderers for the v1 widget kinds. Custom labels must be
  resolved from LABEL Units, and long text must be resolved from content Units.
- [x] 7.6 Add or update app-side query batching so widget LABEL, content,
  realm, zone, and Pinboard references do not cause avoidable N+1 waterfalls.
- [x] 7.7 Add a management page for sidebar widgets. It should support
  placement selection, add/remove/reorder, and per-widget editing.
- [x] 7.8 Follow the package/app interaction rule: entity selection in widget
  editors must use search or picker UI, never raw ID text inputs.
- [x] 7.9 Remove `FeaturedZonePicker` and `WikiSidebarPicker` as standalone
  extra-key editors once their behavior is represented by sidebar widgets.

## 8. Realm Rule and About Cutover
- [x] 8.1 Move rule management from `Realm.extra.rule` to explicit realm rule
  policy fields and update `JoinButton`, `RuleSection`, `RealmCreatePage`, and
  rule acknowledgement flows accordingly.
- [x] 8.2 Represent realm about/sidebar content as `text` sidebar widgets
  instead of `Realm.extra.about`.
- [x] 8.3 Keep the main realm description in Unit translations; sidebar text
  widgets are extra curated content, not a duplicate of the page header
  description.
- [ ] 8.4 Add tests to ensure rule acknowledgement uses the explicit rule
  policy reference and not sidebar widget content.

## 9. Cleanup and Verification
- [x] 9.1 Delete announcement-specific contract constants, server helpers, API
  helpers, app types, i18n keys, tests, and seed/factory branches that are no
  longer referenced.
- [x] 9.2 Rename or delete `realm-extra` list tests after Pinboard tests own
  that behavior.
- [x] 9.3 Update route loaders and `RealmDetailProvider` shape so sidebar and
  rule policy data are available where needed without reading `realm.extra`
  composed-surface keys.
- [x] 9.4 Run focused contract tests for realm sidebar and Pinboard.
- [ ] 9.5 Run focused server tests for Pinboard, realm sidebar, and rule
  policy.
- [ ] 9.6 Run focused app tests for Pinboard hooks/components and realm sidebar
  rendering.
- [x] 9.7 Run `task check:convention`, `task check:i18n`, and relevant package
  builds after the cutover.

Unchecked items above are dedicated follow-up coverage tasks. The clean schema,
API, and app cutover is applied; focused Pinboard/sidebar server and app tests
can be added without changing the model design.

## Out of scope
- A general page builder for realms. Sidebar widgets are compact community
  chrome, not a clone of Zone pages.
- Opening Pinboard `kind` customization in the UI. V1 stores `kind: "list"` but
  does not expose it.
- Supporting multiple user-created Pinboards in the UI. The data model allows
  keys, but v1 product surface manages only `key: "home"`.
- Migrating production data with backward compatibility. This project is in
  development; apply should perform a clean internal cutover.
- Refactoring realm avatar, banner, tag tree, tag view, or default license out
  of `Realm.extra` unless directly required by this work.
