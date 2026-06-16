---
title: Realm Dock
status: active
created: 2026-06-17
completed:
supersededBy:
tags: [contract, server, app, realm, dock, i18n]
---

## Why

Realm sidebar widgets are currently named and routed around a desktop layout
detail, while the product need is broader: a realm-owned Dock that can be
rendered as a side rail on large screens, as a first-class Dock tab/page on
small screens, and as a Wiki-specific Dock above wiki content. The current
`about` and public `members` tabs also make realm metadata look like peer
content destinations, when those concerns should live as Dock modules or deeper
pages.

This change makes Dock the product surface. It moves realm description,
subscriber count, realm facts, rules, moderators, and bookmarks out of scattered
header/tab/sidebar slots into typed Dock items with app-owned default i18n
labels. Custom widget text remains overridable through LABEL Units, but
defaults are not persisted. Backend writes validate shape and authorization
only; stale target references are surfaced by the frontend at render/edit time.

## Durable constraints & decisions

- (type) The durable product model is `RealmDock`, not sidebar. Internal
  contract/API/server/app names should use `dock`; no compatibility layer is
  required during this development-stage cutover.
- (type) `RealmDTO` exposes `dock`, not `sidebar`. The realm DB JSON column
  should be renamed from `sidebar` to `dock` through normal Drizzle migration
  workflow.
- (type) The Dock envelope schema is versioned:
  `schema: "rezics/realm-dock"`, `version: 1`, and `placements` keyed by
  `main` and `wiki`.
- (type) `main` Dock is the realm-wide Dock. On large screens it renders as the
  stream side rail; below the large-screen breakpoint it renders as the Dock tab
  page. `wiki` Dock renders on the Wiki page, before wiki content.
- (test) Realm detail tab navigation shows `Dock` below the large-screen
  breakpoint and hides the Dock tab at the large-screen breakpoint and above.
  The `/dock` route may still exist when the tab trigger is hidden.
- (test) Public `about` and public `members` are no longer top-level realm tabs.
  Description, facts, subscription stat, rules, moderators, and bookmarks live
  in Dock; full member-management remains under manage routes.
- (test) Realm header does not render description, member count, public status,
  official status, or created-at once those facts are Dock-owned. The header
  keeps identity chrome and primary actions only.
- (type) Persisted Dock items are either required builtin items or custom
  widgets. Builtin items may be reordered but not removed.
- (test) The `main` Dock validates required builtin item presence with one
  linear pass over the placement: no repeated `.find()` scans over all required
  items. Duplicate item IDs are rejected in the same pass.
- (type) Required `main` builtin items are:
  `description`, `subscriptionStat`, `realmFacts`, `bookmarks`, `rules`, and
  `moderators`.
- (type) `description` reads `Realm.description`; it does not own a separate
  content reference. It supports an optional `maxLines` config with an app
  default. Empty descriptions render an editor-facing empty/missing state and
  should not produce duplicate public copy.
- (test) Description overflow renders a same-size blue link on the next line:
  `Read full description >` / localized equivalent. Desktop opens a dialog;
  mobile Dock page uses inline expand/collapse.
- (type) `subscriptionStat` renders only the realm subscriber/member count.
  It must not become member details, moderator details, or member analytics.
- (type) `realmFacts` owns created date, public/private visibility, and official
  status. These facts are not duplicated in the header.
- (type) `bookmarks` supports link items and one nested group level. Groups
  render as expandable/dropdown controls; links render as full-width action
  rows/buttons.
- (type) `moderators` is its own Dock builtin. It is not part of
  `memberAnalytics` or member directory modeling.
- (comment) Default widget titles and labels are app-owned i18n derived from
  `kind`/builtin ID. Persisted payloads must not contain `labelKeyDefault`,
  `defaultTitleKey`, or any other app i18n key.
- (type) Custom text overrides use LABEL Unit references, such as
  `titleOverrideUnitId`, `labelOverrideUnitId`, and `altOverrideUnitId`. Absence
  of an override means the app uses its default i18n label and performs no LABEL
  query for that label.
- (test) Server Dock update validates envelope shape and caller authority only.
  It does not validate referenced Unit/Zone/Post/link targets. Invalid or stale
  references are frontend render/edit states.
- (test) Public Dock rendering must not let one stale widget reference break the
  whole Dock. Manage rendering should identify stale widget/item targets clearly
  enough for moderators to repair them.
- (type) `insightWeights` and `memberAnalytics` may be sketched as disabled
  draft objects, with comments explicitly marking them not enabled. They must
  not be injected into the active `RealmDockWidget` schema or editor until data
  sources and product behavior exist.
- (comment) `insightWeights` is separate from `subscriptionStat`: it models
  Reddit-like short weighted insights such as "2.1K Fighting for the Grail".
  There is no current API, so no public renderer should fake values.
- (comment) `memberAnalytics` is separate from `moderators`: it may later model
  top members, member directory, geography, demographics, or activity analytics,
  but not moderator/admin identity.
- (test) The Dock product name is real i18n. English uses "Dock"; Traditional
  Chinese uses "停靠區"; Simplified Chinese uses "停靠区". React components must
  not hard-code visible Dock labels.

## Tasks

## 1. Contract and schema

- [x] 1.1 Replace `package/contract/src/realm/realm-sidebar.ts` with
  `package/contract/src/realm/realm-dock.ts`, exporting
  `REALM_DOCK_SCHEMA`, `REALM_DOCK_V1_VERSION`, `realmDockPlacementValues`,
  `realmDockEnvelopeSchema`, `parseRealmDock`, `emptyRealmDock`,
  `RealmDock`, `RealmDockPlacement`, `RealmDockItem`, and
  `RealmDockWidget`.
- [x] 1.2 Define active placements as `main` and `wiki`; remove `home` and
  `about` from the active contract vocabulary.
- [x] 1.3 Define builtin item schemas for `description`, `subscriptionStat`,
  `realmFacts`, `bookmarks`, `rules`, and `moderators`, with stable IDs and
  reorderable item wrappers.
- [x] 1.4 Define custom widget schemas for the existing supported custom widget
  kinds that still make sense in Dock: `text`, `buttons`, `images`,
  `communityList`, `calendar`, `featuredZone`, `zoneNav`, `stats`, and
  `pinboard`.
- [x] 1.5 Convert custom text fields to override references:
  `titleOverrideUnitId`, `labelOverrideUnitId`, and `altOverrideUnitId`.
  Remove any implication that a custom title/label is required when the app has
  a default.
- [x] 1.6 Add `bookmarks` item config shape for direct links and one nested
  group level. Bookmark labels may use overrides, but default labels are app
  derived and not stored.
- [x] 1.7 Add optional disabled draft object exports for `insightWeights` and
  `memberAnalytics` with explicit comments that they are not injected into
  `realmDockWidgetSchema` and are not editor-enabled.
- [x] 1.8 Update `package/contract/src/realm/realm.ts` so `realmDTOSchema`
  exposes `dock` and no longer exposes `sidebar`.
- [x] 1.9 Update contract exports from `package/contract/src/realm/index.ts`
  and `package/contract/src/index.ts`.
- [x] 1.10 Replace `package/contract/src/realm/realm-sidebar.test.ts` with
  Dock tests for the schema envelope, active placements, required `main`
  builtins, duplicate item rejection, override-only custom labels, and disabled
  draft objects not being accepted by the active widget schema.

## 2. Database, server, and API

- [x] 2.1 Rename `Realm.sidebar` to `Realm.dock` in
  `package/server/src/db/schema/realm.ts`.
- [x] 2.2 Generate the Drizzle migration for the JSON column rename, following
  `docs/guide/database-workflow.md`.
- [x] 2.3 Update `package/server/src/realm/realm.mapper.ts` and mapper tests so
  Realm DTOs map `dock` through `parseRealmDock` / `emptyRealmDock`.
- [x] 2.4 Replace `package/server/src/realm/realm-sidebar.service.ts` with
  `realm-dock.service.ts`. Keep realm manage authorization, parse the Dock
  envelope, validate shape, and remove server-side target-reference validation.
- [x] 2.5 Replace `package/server/src/realm/realm-sidebar.api.ts` with
  `realm-dock.api.ts`, using `/realm/:unitId/dock` for read/update routes and
  tags/summaries named `RealmDock`.
- [x] 2.6 Mount the Dock API from `package/server/src/index.ts` and remove the
  sidebar API mount/export.
- [x] 2.7 Replace `package/api/src/realm/realm-sidebar.api.ts`,
  `.queries.ts`, `.mutations.ts`, and `.keys.ts` with `realm-dock.*`, pointing
  at `/realm/:realmId/dock`.
- [x] 2.8 Update server/API tests that currently mention sidebar routes,
  sidebar keys, or sidebar DTO fields.
- [x] 2.9 Confirm there is no server code that validates referenced LABEL,
  POST, REALM, or ZONE existence during Dock update.

## 3. App feature extraction

- [x] 3.1 Create `package/app/src/realm-dock/index.ts` and move Dock-specific
  public exports there.
- [x] 3.2 Create `package/app/src/realm-dock/components/RealmDock.tsx` as the
  placement renderer for builtin items and custom widgets.
- [x] 3.3 Move and rename existing `RealmSidebar` widget renderers into
  `realm-dock/components`, preserving current weak-degrade behavior and adding
  explicit stale-target displays where needed.
- [x] 3.4 Add `DockDescription.tsx`, reading `realm.description`, honoring
  `maxLines`, rendering the localized full-description link on overflow, and
  using dialog on desktop plus inline expand/collapse on mobile Dock page.
- [x] 3.5 Add `DockSubscriptionStat.tsx`, rendering only
  `realm.memberCount` with app-owned default i18n label and optional LABEL
  override label.
- [x] 3.6 Add `DockRealmFacts.tsx`, rendering created date, visibility, and
  official status with localized labels and icons.
- [x] 3.7 Add `DockBookmarks.tsx`, rendering full-width bookmark links and one
  expandable/dropdown group level.
- [x] 3.8 Add `DockModerators.tsx` as a moderator/admin summary widget that is
  not part of member analytics. It may link to a deeper moderators page if the
  data/route exists; otherwise it should degrade clearly.
- [x] 3.9 Add `DockWidgetError.tsx` or equivalent shared stale-target UI for
  frontend-only invalid reference handling.
- [x] 3.10 Add app-side default-title/label mapping keyed by Dock builtin ID
  and custom widget kind. This mapping lives in app code, is type-checked
  against contract value sets, and is not persisted.

## 4. Routes and layout

- [x] 4.1 Update `package/app/src/realm/models/realmDetailRoutes.ts` so public
  detail tabs are `stream`, `wiki`, `tags`, and `dock`; remove `about` and
  public `members` from the tab union.
- [x] 4.2 Update `package/app/src/realm/sections/RealmDetailShell.tsx` to
  render a localized Dock tab trigger below `lg` and hide it at `lg` and above.
- [x] 4.3 Add slug and unit-id Dock routes:
  `package/app/src/routes/_mainLayout/r/$realmSlug/dock.tsx` and
  `package/app/src/routes/_mainLayout/realm/$realmId/_detail/dock.tsx`.
- [x] 4.4 Remove or retire public `about` routes from the realm tab shell:
  `package/app/src/routes/_mainLayout/r/$realmSlug/about.tsx` and
  `package/app/src/routes/_mainLayout/realm/$realmId/_detail/about.tsx`.
- [x] 4.5 Remove or retire public `members` routes from the realm tab shell:
  `package/app/src/routes/_mainLayout/r/$realmSlug/members.tsx` and
  `package/app/src/routes/_mainLayout/realm/$realmId/_detail/members.tsx`.
- [x] 4.6 Update `RealmStreamTab` so `main` Dock renders only in the large
  desktop side rail; small screens use the Dock tab/page.
- [x] 4.7 Update `RealmWikiTab` so `wiki` Dock renders before wiki content,
  matching mobile navigation needs and avoiding a bottom-of-page discovery
  problem.
- [x] 4.8 Update `RealmDetailLayout` to remove description, member count,
  public status, official status, and created/fact chrome from the header once
  Dock replacements exist.
- [x] 4.9 Ensure route title metadata remains correct after `/about` and
  `/members` are no longer first-class tabs.

## 5. Dock management

- [x] 5.1 Replace `package/app/src/realm/sections/RealmSidebarWidgetEditor.tsx`
  with a Dock editor under `package/app/src/realm-dock/editor/`.
- [x] 5.2 Rename `package/app/src/realm/pages/manage/RealmManageWikiPage.tsx`
  to a Dock management page, or create `RealmManageDockPage.tsx` and remove the
  old wiki-specific wrapper.
- [x] 5.3 Update manage route files from `/manage/wiki` to `/manage/dock` for
  slug and unit-id route trees.
- [x] 5.4 Update `package/app/src/realm/models/realmManageRoutes.ts` so the
  manage navigation uses `dock` with localized Dock labels instead of `wiki`.
- [x] 5.5 In the Dock editor, expose placement selection as `Main Dock` and
  `Wiki Dock`, not `Home/Wiki/About`.
- [x] 5.6 In the Dock editor, render required builtin items with move controls
  only; no delete button.
- [x] 5.7 In the Dock editor, render custom widgets with add/remove/reorder
  controls and per-kind config fields.
- [x] 5.8 In the Dock editor, do not prompt users to create LABEL Units for
  default titles or labels. Show override fields as optional advanced edits.
- [x] 5.9 In the Dock editor, surface stale target references through frontend
  query failures or missing target states without blocking reorder/save.

## 6. i18n and product copy

- [x] 6.1 Add `realm_tab_dock` and Dock management labels to every
  `package/i18n/locales/*/entity.json` and `community.json` namespace currently
  used by realm tab/manage navigation.
- [x] 6.2 Use true localized product names:
  English `Dock`, Traditional Chinese `停靠區`, Simplified Chinese `停靠区`,
  Japanese `ドック`, Korean `도크`, and German `Dock`.
- [x] 6.3 Replace visible `realm_sidebar_*` copy with `realm_dock_*` copy.
- [x] 6.4 Add default app i18n labels for Dock builtins and widget kinds,
  including description, subscription stat, realm facts, bookmarks, rules,
  moderators, buttons, images, community list, featured zone, zone nav, stats,
  and pinboard.
- [x] 6.5 Add localized overflow link copy for description:
  `Read full description >` and equivalents.
- [x] 6.6 Run `task check:i18n` after locale changes.

## 7. Tests, stories, and verification

- [x] 7.1 Update focused contract tests for Dock parsing, required builtins,
  duplicate detection, active placements, and disabled draft schemas.
- [ ] 7.2 Update focused server tests for Dock read/update authorization and
  absence of server-side reference validation.
- [x] 7.3 Update focused API tests/keys for Dock query and mutation helpers.
- [ ] 7.4 Update or add app tests for active tab calculation, large-screen Dock
  tab hiding, small-screen Dock tab presence, and stream/wiki Dock placement.
- [x] 7.5 Update Storybook stories that use Realm detail, Wiki tab, or sidebar
  fixtures so they use `dock`.
- [x] 7.6 Run focused tests first, then `task check:i18n`, and only broaden to
  `task test` if the focused surface passes or failures suggest shared
  breakage.
- [ ] 7.7 For layout-affecting app changes, verify 320px, 768px, 1280px, and
  >=2560px viewports manually after implementation. If browser verification is
  not run, report that honestly.

## Out of scope

- Building active insight metrics, active-now counts, or Reddit-like weighted
  insight renderers. `insightWeights` may be documented as disabled draft shape
  only.
- Building member analytics, demographic charts, geography distributions, or a
  general member directory. `memberAnalytics` may be documented as disabled
  draft shape only.
- Backend validation that target Unit/Zone/Post references exist. Stale
  references are frontend render/editor states.
- A general realm page builder. Dock remains a curated realm information and
  navigation surface, not arbitrary layout composition.
- Keeping `/sidebar` API or `sidebar` DTO compatibility aliases.
- Translating the internal English identifier `Dock` in code identifiers. User
  visible text is localized through i18n; source identifiers stay English.
