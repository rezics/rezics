---
title: Official zones as type libraries — realms zone repositioned, zones zone added
status: active
created: 2026-06-11
completed:
supersededBy:
tags: [zone, seed, official-zones]
---

## Why

Official zones today are `book` (a library: latest / popular / reviews),
`realms` (framed as discovery: "Discover communities", quality + trending
sorts only), and `popular` (cross-type trending). Two problems: the realms
zone should be a **realms library** (庫) exactly like the book library —
browsable catalog first, while trending/discovery is `popular`'s job — and a
**zones library** (`/z/zones`, the catalog of ZONE units) is missing
entirely. Both fit existing primitives: `ZONE` is a valid unit type, boundary
filters and query sections accept `types`, and ZONE units flow through
content sync. No new schema.

## Durable constraints & decisions

- (comment) **Official-zone framework**: official zones are either *type
  libraries* (one per major UnitType: book / realms / zones) or
  *cross-cutting views* (popular). Libraries lead with browsable catalog
  sections (latest, browsable all, activity); trending-led discovery belongs
  to `popular`. This is the criterion for any future ENTITY/SHELF library.
  Home: header comment in `seed-official-zones.ts` next to
  `OFFICIAL_ZONE_DEFINITIONS`.
- (comment) **Library sort caveat for ZONE units**: zones rarely accumulate
  score signals early, so the zones library leads with
  `createdAt`/`updatedAt` sorts; a qualityScore section is acceptable but
  must not be the primary section. (Sortable fields verified:
  `ZONE_QUERY_SORTABLE` covers all of them; ZONE units are indexed via
  content sync.)
- (comment) "Realm" and "Zone" stay untranslated product terms in zh-hant
  titles only if that is the existing convention — book is 書籍, so the
  libraries get real titles: realms → keep "Realms" as product term but
  library-framed description; zones → 「專區」 (matching the contract's
  established 专区/專區 terminology), en "Zones", ja「ゾーン」.
- (type) New official zone key `"zones"` joins the
  `OfficialZoneDefinition["key"]` union and `OFFICIAL_ZONE_SLUGS`; the
  seeded-id record type propagates consumers (registration defaults) at
  compile time.
- (test) Seeds bypass the zone service write path (existing invariant): the
  new/changed page envelopes must parse through the contract schemas — lock
  the zones definition with the same envelope-parse coverage the existing
  definitions have (extend the existing seed test if present, else add to
  the definition test surface).

## Tasks

## 1. Realms zone → realms library

- [ ] 1.1 `package/server/src/db/seed/infra/seed-official-zones.ts`
  (`realmsConfig`): mirror the book library's three-section structure —
  latest realms (`createdAt` desc, rail display), browse realms
  (`qualityScore` desc, grid/tiles, loadMore), realm activity (`updates`
  feed). Drop the trending-led section (popular's job).
- [ ] 1.2 Update `realms` translations: descriptions in en/zh-hant/ja shift
  from "Discover communities…" to library framing (the realm catalog, 就跟書
  庫一樣); keep "Realms" titles.

## 2. Zones zone (/z/zones)

- [ ] 2.1 `seed-official-zones.ts`: add `OFFICIAL_PAGE_IDS.zones`
  (`…0401/0402/0403`), `zonesConfig` (`filters: { types: ["ZONE"] }`; home:
  latest zones `createdAt` desc rail, all zones `updatedAt` desc grid with
  loadMore, feed page as usual), and the `zones` entry in
  `OFFICIAL_ZONE_DEFINITIONS` with translations (en "Zones", zh-hant 「專區」,
  ja 「ゾーン」); add the framework comment from the constraints above.
- [ ] 2.2 `package/server/src/user/service/registration-defaults.ts`: handle
  the new `zones` key in the seeded-id record — include it in default
  subscriptions for symmetry with the other official zones (deviate only if
  the site reveals a reason; then comment why).
- [ ] 2.3 `package/app/src/zone/models/officialZoneRoutes.ts` (+ its test):
  add `zones` to `OFFICIAL_ZONE_SLUGS`.
- [ ] 2.4 Wire app entry points that enumerate official zones:
  `package/app/src/core/components/footer/MainLayoutFooter.tsx` and
  `package/app/src/home/sections/QuickAccessLinks.tsx` (and any other
  `officialZoneHref` consumers the compiler/grep surfaces).

## 3. Verify

- [ ] 3.1 Re-run the seed (`task db:migrate` if needed, then seed infra path)
  and verify `/z/realms` and `/z/zones` render: library sections populated,
  search and feed pages reachable. Give the user the URLs after `task dev`.
- [ ] 3.2 Run touched tests (`officialZoneRoutes.test.ts`, seed/server
  suites), `task check:convention`, `task format`.

## Out of scope

- New section kinds, display variants, or browse facets (language/topic
  faceting for the realms library is a possible future exploration).
- ENTITY/SHELF libraries (the framework comment is their criterion, not
  their implementation).
- Realm-side zone bindings (`realm-featured-zone-and-wiki-sidebar.md`) and
  the Toaru fixture rename (`toaru-zone-naming-cutover.md`).
