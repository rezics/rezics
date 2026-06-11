---
title: Realm featured-zone card + wiki tab sidebar tri-state source
status: active
created: 2026-06-11
completed:
supersededBy:
tags: [realm, zone, wiki]
---

## Why

`realm.extra.wikiZoneUnitId` frames the realm↔zone relation as "the realm's
themed wiki portal": it is surfaced only as a link card inside the wiki tab's
sidebar and it gates wiki tab visibility (`RealmDetailLayout.tsx:88`). That
framing is wrong three ways: a zone is a realm's portal, not a wiki appendix;
most realm wikis are GitHub/Reddit-style and never need a zone (Fandom-style
portals are the minority); and tab visibility should not hang on a zone
pointer. This plan replaces the single wiki-framed pointer with two independent
weak links — a **featured zone card** in the realm main sidebar (feed tab
aside, beside About/Rules) and a **tri-state wiki sidebar source**
(auto page list / sidebar post / unthemed zone nav) — and removes
`wikiZoneUnitId` in a clear cutover (no code or data compatibility required).

## Durable constraints & decisions

- (comment) **Weak-link philosophy.** `featuredZoneUnitId` and the
  `wikiSidebar` references get **no server-side referential validation** — no
  existence check, no ownership check; `featuredZoneUnitId` may point at any
  zone. The frontend resolves the reference and degrades by rendering nothing;
  the manage editor surfaces resolution failure. The only structural
  realm↔zone relation remains `zone.ownerRealmUnitId` (zone claims its owner,
  never the reverse). Goes next to the new extra keys in `realm-extra.ts` and
  the service key handling.
- (type) `wikiSidebar` is a single-source discriminated union, not a list:
  `{ kind: "post", postUnitId }` | `{ kind: "zoneNav", zoneUnitId, menuId? }`;
  key absent = auto page list (GitHub default-sidebar semantics; the union is
  the `_Sidebar.md` analogue).
- (comment) **Unthemed zone nav is free by construction.** Zone theme vars
  (`--zone-color-*`) are injected only at the zone portal root
  (`ZonePortalPage`); components reference `var(--zone-color-*, fallback)`.
  `ZoneNavTree` must use app tokens only and must never inject theme vars —
  rendering it outside `/z/` is automatically app-themed. Goes on
  `ZoneNavTree`.
- (test) zoneNav menu selection: explicit `menuId` when present, else
  `nav.header.menuId`; unknown/missing menu → render nothing, never throw.
- (comment) zoneNav link targets resolve through the existing `zoneMenu` model
  into the zone frame (`/z/...`): clicking a nav entry **enters the portal**.
  Realm-side wiki reader routes (persistent-sidebar GitHub-wiki reading) are
  deliberate future work, not this plan.
- (comment) **Wiki tab is always visible** — it is a first-class realm
  capability like Tags/About; conditional visibility was a symptom of the zone
  binding. `showWikiTab` is removed, the tab's existing EmptyState covers the
  no-content case.
- (comment) The featured zone card uses app tokens and matches the
  About/Rules card family; zone theming begins only past the `/z/` threshold.

## Tasks

## 1. Contract

- [ ] 1.1 `package/contract/src/realm/realm-extra.ts`: remove `wikiZoneUnitId`;
  add `featuredZoneUnitId` (optional nullable string) and
  `realmWikiSidebarSchema` discriminated union (`post` / `zoneNav`,
  `additionalProperties: false`) with exported types; doc comments carry the
  weak-link decision.
- [ ] 1.2 `package/contract/src/realm/realm.test.ts`: migrate `wikiZoneUnitId`
  fixtures; add union shape tests (both kinds valid, malformed/extra-prop
  rejected, absent key allowed).

## 2. Server

- [ ] 2.1 `package/server/src/realm/realm-extra.service.ts`: swap
  `wikiZoneUnitId` for `featuredZoneUnitId` + `wikiSidebar` in
  `SingleExtraKey`/`SINGLE_EXTRA_KEYS`; delete `validateZoneUnit` and the
  repository `zoneExists` method; validate `wikiSidebar` values against the
  contract union schema (shape only).
- [ ] 2.2 `package/server/src/realm/realm-extra.service.test.ts`: drop the
  zone-existence test; add: `featuredZoneUnitId` accepts an arbitrary id (weak
  link, locked); `wikiSidebar` accepts both kinds, rejects malformed shapes.

## 3. Zone feature — unthemed nav tree

- [ ] 3.1 `package/app/src/zone/models/zoneMenu.ts`: add
  `pickZoneMenu(nav, menuId?)` (explicit id → fallback `header.menuId` → null);
  unit tests in `zoneMenu.test.ts` for the fallback and unknown-id cases.
- [ ] 3.2 New `package/app/src/zone/components/ZoneNavTree.tsx`: collapsible
  recursive tree (≤ `ZONE_MENU_MAX_DEPTH`) over a `ZoneMenu`, hrefs via
  `zoneLinkHref`, app tokens only; export through
  `package/app/src/zone/index.ts` (realm consumes via the feature index).

## 4. Realm — featured zone card

- [ ] 4.1 New `package/app/src/realm/sections/FeaturedZoneSection.tsx`:
  resolve `realm.extra.featuredZoneUnitId` via `zonePortalQueryOptions`;
  render a card (zone title, one-line description, enter button → `/z/$slug`)
  in the About/Rules visual family; render nothing while unresolved or on
  error.
- [ ] 4.2 Mount it in `package/app/src/realm/sections/RealmFeedTab.tsx` aside
  alongside `AboutSection`/`RuleSection`.

## 5. Realm — wiki tab sidebar tri-state

- [ ] 5.1 Rewrite the aside in
  `package/app/src/realm/components/RealmWikiTab.tsx`: absent → auto list of
  the realm's wiki pages (titles from the existing `wikiByRealm` query, same
  href convention as `PostCard`); `post` → `postQueries.detail` +
  `PostBodyMarkdown` following the `AboutSection` pattern (no clamp);
  `zoneNav` → `zonePortalQueryOptions` + `pickZoneMenu` + `ZoneNavTree`.
  Remove the old zone link card and the "Wiki setup" card.
- [ ] 5.2 Update `RealmWikiTab.stories.tsx` to cover the three sidebar states.

## 6. Wiki tab visibility decoupling

- [ ] 6.1 Remove `showWikiTab` from
  `package/app/src/realm/pages/realmDetailContext.tsx`,
  `RealmDetailLayout.tsx`, and the conditional trigger in
  `package/app/src/realm/sections/RealmDetailShell.tsx` — Wiki tab always
  renders.

## 7. Manage editors

- [ ] 7.1 `package/app/src/realm/sections/RealmManageEditors.tsx` +
  `package/app/src/realm/pages/RealmManagePage.tsx`: replace the wiki-zone
  editor with (a) a featured-zone editor (id input + live resolve preview —
  the existing pattern — resolution failure shown as the frontend validation)
  and (b) a wiki-sidebar editor (kind select auto/post/zoneNav + per-kind id
  fields with the same live-resolve treatment).
- [ ] 7.2 Replace `realm_wiki_zone*` keys in
  `package/i18n/locales/*/entity.json` (en, zh-hant, zh-hans, ja, ko, de) with
  featured-zone and wiki-sidebar keys; do not touch `package/admin/dist`
  build artifacts.

## 8. Sweep

- [ ] 8.1 Repo-wide `wikiZoneUnitId` grep returns zero hits (clear cutover);
  run `task format`, `task check:convention`, and the touched test suites
  (`contract`, `server` realm-extra, app `zoneMenu`).

## Out of scope

- Realm-side wiki reader route (persistent sidebar + content pane reading
  experience) and re-routing zoneNav targets into realm context.
- Derived "zones owned by this realm" listing (inverse direction via
  `ownerRealmUnitId`).
- The sibling exploration threads: `toaru-wiki` fixture renaming, zone
  carousel rewrite, official `zones`/`realms` zone rework — separate
  proposals.
