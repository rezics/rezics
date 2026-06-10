---
title: Zone Shell/Page Split — Shell Columns, ZonePage Rows, and Open Slug Pages
status: active
created: 2026-06-10
completed:
supersededBy:
tags: [zone, contract, server, db, api, app, factory, meili]
---

## Why

The current single `Zone.config` envelope couples the zone shell
(`boundary`, `nav`, and `theme`, needed on every page) with page configuration
(only one page is rendered at a time). That shape causes every portal render to
load every page, every manage-tab save to rewrite the full config and risk
cross-tab lost updates, a fixed page set (`home`, optional `search`, optional
`feed`), and overly coarse versioning.

Split along load and update boundaries: three shell JSON envelope columns on
`Zone`, plus one `ZonePage` row per custom page. The target query shape becomes
`zoneId + slug -> config`. This is a clean development-stage cutover with
factory reseed and no compatibility for old `rezics/zone-config` rows. It
depends on the shared envelope module from `json-evolution-policy.md`.

## Durable constraints & decisions

- Target shape: (type)
  - `Zone` shell columns: `boundary` (`context` + filters,
    `rezics/zone-boundary` v1), `nav` (menus + header,
    `rezics/zone-nav` v1), and `theme` (`rezics/zone-theme` v1), plus
    `homePageId` FK.
  - `ZonePage`: UUID PK, `zoneUnitId` FK with cascade, `slug`,
    `unique(zoneUnitId, slug)`, `config` (`rezics/zone-page` v1,
    `{ sections: [...] }`), and `position`.
- Split the shell into three columns because they match manage tabs and enable
  column-level updates, which removes cross-tab lost updates. Each column has an
  independent envelope and independent version evolution. (comment ->
  `db/schema/zone.ts`)
- `nav` remains JSON, not relational tables: menus are recursive trees up to
  three levels, loaded as whole trees, and never queried by node. `header` and
  `menus` live in the same envelope; `header.menuId` validation remains an
  in-envelope transaction. (comment)
- Sections are not split into rows. Tabs and columns make sections a tree, and
  sections are always loaded with their page. Splitting them would over-normalize
  this model. (comment)
- The home invariant uses `Zone.homePageId` FK for rename safety and explicit
  semantics, not a reserved slug. Zone creation must create a home page, and the
  page referenced by `homePageId` cannot be deleted. (type + test)
- Menu targets with `{ kind: "zonePage" }` reference `pageId`, not slug, so
  slug renames do not break links. Page deletion is blocked server-side when nav
  still references the page, with reference locations reported; rendering hides
  dangling references as a second defense. (test + comment)
- Search/feed special pages are dissolved. A page is always a pure section
  container; feed uses the existing feed section kind, and search remains a
  shell-level built-in route rather than a `ZonePage` row. If page-level
  specialization is needed later, add a `kind` field additively. (comment +
  test: arbitrary slug pages can be created)
- Section id uniqueness narrows from the whole zone to one page. Section data
  execution APIs gain a page parameter. (type + test)
- Theme `logoUrl/bannerUrl/backgroundUrl`, hero
  `bannerImageUrl/logoImageUrl`, and header `logoImageUrl` are plain URL
  strings. Schema validation only requires `https:` and does not restrict
  domains; communities can link externally, and CSP is a separate decision.
  Decorative images do not become IMAGE units. IMAGE units are catalog works,
  as defined by `json-evolution-policy.md` task 4.2. (type + comment)
- Add optional `displayUnitId` to `ZoneCollectionItem`: render that unit's
  avatar/title through the existing `ZoneRefUnitSummary.imageUrl` pipeline, but
  keep click behavior on `target` so an item can link to a wiki page. This is an
  additive optional field and the first example of additive-compatible
  discipline. Wiki pages can point back to entities through ContentDoc
  `afterMain` `unit-ref` blocks rendered as bottom cards. A Wikipedia-style
  infobox belongs to a future doc-v2 direction, not a new mechanism here.
  (type + comment -> link-target / section contract)
- Add an avatar-wall collection display variant for pages such as
  `Category:Characters` / "main characters". (type)
- A zone page is a layout container that lets community pages migrate gradually
  along the spectrum from fully edited text to fully data-driven sections. A
  single richText section pointing at a wiki post is a degenerate case of
  section aggregation, not a parallel page model. (comment -> zone-page module
  JSDoc)
- Design for Zone table scale on the order of subreddits (10^5-10^6 rows);
  table size does not change the storage shape. (comment)
- Known vocabulary gaps are intentionally recorded but not implemented here:
  grouped query, collapsible sections, and in-page TOC/anchors. (comment ->
  section contract bookkeeping)

## Tasks

## 1. Contract (`@rezics/contract` Zone Module)

- [ ] 1.1 Split `config-v1.ts` into `boundary-v1.ts`, `nav-v1.ts`,
      `theme-v1.ts`, and `page-v1.ts`, each as an envelope built through the
      shared envelope module and each with its own upgrade chain. Delete the
      monolithic `rezics/zone-config` envelope and fixed-key `zonePagesSchema`.
- [ ] 1.2 Convert theme/hero/header image fields from unit ids to HTTPS URLs;
      add optional `ZoneCollectionItem.displayUnitId`; add an avatar-wall
      collection display variant; change `ZoneLinkTarget.zonePage` to reference
      `pageId`.
- [ ] 1.3 Reshape DTOs: `zoneDTOSchema` returns the shell
      (`boundary`, `nav`, `theme`, translations, lifecycle, `homePageId`) plus
      a page list (`id`, `slug`, `position`, no `config`); portal response
      returns shell + requested page config + `refUnits`; add page CRUD input
      schemas; add `pageId` to section-data requests.
- [ ] 1.4 Synchronize zone i18n keys if manage-page copy changes.

## 2. Server (DB + Domain)

- [ ] 2.1 Update `db/schema/zone.ts`: add the three shell columns and
      `homePageId`, add the new `ZonePage` table, and generate a Drizzle
      migration with `task db:generate`. Because this is development-stage,
      delete the old `config` column without data migration.
- [ ] 2.2 Implement `zone.service.ts` changes: hydrate shell from three parsed
      envelope columns; add page CRUD with unique slug, position ordering,
      home-page deletion guard, and nav-reference deletion guard with reported
      locations; move validation for page-local section ids, menu depth, refs,
      and boundary vocabulary to the new shape; address section execution by
      `(zoneId, pageId, sectionId)`.
- [ ] 2.3 Update `zone.api.ts` and mapper: shell PATCH endpoints by column
      (`boundary`, `nav`, `theme`), page CRUD routes, portal route with
      `pageSlug`, and shell-level built-in search route.
- [ ] 2.4 Update Meili `filters.ts`: read boundary filters from `Zone.boundary`
      instead of `config.filters`; keep compile behavior unchanged.
- [ ] 2.5 Update server tests: `zone.service.test`, `zone.mapper.test`, and
      `zone.by-slug.test`; add tests for the home invariant and page deletion
      nav-reference guard.

## 3. `@rezics/api`

- [ ] 3.1 Update `zone/zone.api.ts`, `zone.queries.ts`, `zone.mutations.ts`,
      and `zone.keys.ts` for shell column endpoints, page CRUD, portal
      `(slug, pageSlug)`, section-data `pageId`, and `useZoneBySlug`.

## 4. App (`package/app/src/zone`)

- [ ] 4.1 Split `models/zoneManageDraft.ts` into three shell drafts
      (`boundary`, `nav`, `theme`) plus a page draft containing one page's
      sections. Move menu and section tree operations to their new homes. Add a
      `pageSlug` segment to `zoneDetailRoutes` and `officialZoneRoutes`.
- [ ] 4.2 Recompose `ZoneManagePage`: boundary tab (including old filters),
      menus tab, and theme tab save by column; sections tab becomes page
      management with page list CRUD, slug editing, ordering, selected-page
      section editing.
- [ ] 4.3 Update portal rendering: `ZonePortalPage` fetches shell + one page by
      `(slug, pageSlug)`; dangling pageId menu targets degrade to hidden;
      collection renders `displayUnitId` avatar/title and avatar-wall display;
      theme/hero/header images render URLs.
- [ ] 4.4 Update app-side tests such as `zoneManageDraft.test`.

## 5. Factory and Closeout

- [ ] 5.1 Update `package/server/src/db/factory/zones.ts` and the toaru-wiki
      scenario to emit three shell envelopes plus multiple page rows
      (`home` and custom pages such as `characters`), covering
      `displayUnitId`, avatar-wall display, and URL images.
- [ ] 5.2 Verify `task seed:factory:fast`, `task test`, and
      `task check:convention`; run `task knip` to remove exports left behind by
      the split.

## Out of scope

- Grouped query, collapsible sections, in-page TOC/anchors, and infobox sidebar
  work. Infobox belongs to a future doc-v2 direction.
- IMAGE unit upload/library product work and manage editor UI improvements
  (`zone-manage-editor.md`).
- Zone discovery/listing and permission model changes.
- Compatibility with old `rezics/zone-config` data; development-stage reseed is
  required.
