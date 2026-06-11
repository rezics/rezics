---
title: Toaru fixture naming cutover — zone is the realm's portal, not a wiki
status: active
created: 2026-06-11
completed:
supersededBy:
tags: [zone, factory, naming]
---

## Why

The `toaru-wiki` factory scenario names the `/z/toaru` zone "魔法禁書目錄
Wiki / Toaru Wiki / とある魔術の禁書目録 Wiki" and narrates the realm as "the
wiki realm backing the /z/toaru portal". That framing is wrong: rezics zones
subsume wiki functionality but are not wikis — a zone is the realm's portal,
named after the community/work. The fixture's own content already proves it
(the /z/toaru home is feeds + discussions + releases + stats; wiki is one
slot, "維基建設" is one nav item among several). Only the names lag. This is
a clear cutover of fixture naming and narrative; no schema or behavior
changes.

## Durable constraints & decisions

- (comment) **Zone naming principle**: a zone is named after its community or
  work ("魔法禁書目錄 / Toaru / とある魔術の禁書目録"), never "<X> Wiki" — we
  are not Fandom; the wiki is a section inside the portal. Home: next to the
  zone Unit creation in the scenario (`scenarios.ts`, zone translations
  block).
- (comment) **What keeps the wiki name** — these refer to the actual wiki
  feature and must NOT be renamed: the `/z/$slug/wiki/$wikiUnitId` route,
  `kind: "WIKI"` units/fragments, the "維基建設 / Wiki Building" nav label,
  and the external "Toaru Wiki (Fandom)" link (that one really is a Fandom
  wiki — the contrast is the point).
- (type) Scenario id `toaru-wiki` → `toaru` in `FACTORY_SCENARIO_NAMES`; the
  literal union propagates every internal callsite (dev-stage clear cutover,
  no alias kept).

## Tasks

- [ ] 1.1 `package/server/src/db/factory/scenarios.ts`: rename scenario id
  `toaru-wiki` → `toaru` (`FACTORY_SCENARIO_NAMES`, scenario registry entry,
  `extra: { scenario }`, all `addSpecialSeedTarget` scenario fields, ANCHOR
  comments); zone translations drop the "Wiki" suffix in all three languages;
  zone description copy shifts from "encyclopedia and portal" to portal-first
  ("社群門戶,含百科" framing); seed-target labels/notes drop "wiki realm"
  ("Toaru realm", "r/toaru — the realm behind the /z/toaru portal"); add the
  naming-principle comment.
- [ ] 1.2 `package/server/src/db/factory/zones.ts` +
  `package/server/src/db/factory/scenarios.test.ts`: update `toaru-wiki`
  references and any "Toaru Wiki" display-name fixtures.
- [ ] 1.3 Display-name fixtures in tests:
  `package/api/src/zone/zone.api.test.ts`,
  `package/contract/src/zone/section.test.ts`,
  `package/server/src/zone/zone.mapper.test.ts`,
  `package/server/src/zone/zone.aa-service.test.ts`,
  `package/app/src/zone/models/zoneMenu.test.ts` — "Toaru Wiki" → portal
  naming.
- [ ] 1.4 Sweep: repo grep for `toaru-wiki` and `Toaru Wiki` returns zero
  src/test hits (plan/ history may keep them); run the touched test suites
  and `task seed:factory:fast` to confirm the scenario still seeds.

## Out of scope

- Any schema, route, or runtime behavior change.
- The realm featured-zone / wiki-sidebar work
  (`realm-featured-zone-and-wiki-sidebar.md`) and official zones rework
  (`official-zones-type-libraries.md`).
