---
title: Zone sources section — render the zone unit's external refs via the entity-source system
status: active
created: 2026-06-11
completed:
supersededBy:
tags: [zone, source, contract]
---

## Why

The Fandom link on `/z/toaru` is a hand-authored collection item using the
`external` link-target arm — the arm whose contract comment defines it as the
deliberate zero-inline-text exception for one-off strings (QQ 群號-style
contact channels). A wiki counterpart on another platform is not a one-off
string; it is a structured external presence, which is exactly what the
entity-source system models (`SourceSite` refRules → `UnitExternalRef` with
derived `canonicalUrl`). That system is fully built through the API layer but
has **zero app-side readers** (admin-only today). A `sources` zone section
becomes its first reader surface: it renders the zone unit's own external
refs. Blast radius is small — the public `unit-external-ref` list endpoint
already exists, so this is a contract literal, an app section component, a
manage entry, and factory demo data.

## Durable constraints & decisions

- (comment) **The anchor is the zone's own unit.** A ZONE is a Unit and
  carries `UnitExternalRef`s directly; the section has no `unitId` field and
  always queries `ctx.zone.unitId`. Semantics: a zone's refs are "this
  portal's counterparts elsewhere" (toaru zone → toaru.fandom.com). Home: the
  section schema doc comment.
- (comment) **Boundary between sources and custom links**: external presences
  of the subject → `sources` section (labels from the site ENTITY's
  translations, URLs from `canonicalUrl` — no inline text, no URL rot);
  one-off contact channels (QQ 群號, Discord invite) → the collection
  `external` target, which remains the zero-inline-text exception. Goes next
  to the existing exception comment in `link-target.ts`.
- (comment) **Thin reader, no hydration path.** The section reads the public
  `unit-external-ref` list endpoint directly from the app; it deliberately
  does not go through the zone section-data endpoint — the source system is
  the single owner of this data.
- (type) Section schema: `{ id, kind: "sources" }` plus the shared optional
  title props; joins the section union as the ninth kind.
- (type) `externalKinds` gains `"wiki"` (registry entry,
  `suggestedUnitTypes: ["ZONE"]`) so a Fandom-style site can declare its
  refRule.
- (test) Empty refs → the section renders its empty/none state, never an
  error; unknown site entity translation falls back to the site key.

## Tasks

## 1. Contract

- [ ] 1.1 `package/contract/src/zone/section.ts`: add
  `zoneSourcesSectionSchema` (`kind: "sources"`, shared title props,
  `additionalProperties: false`) to the section union, with the anchor
  comment; cover in `section.test.ts` (valid shape, extra-prop rejection).
- [ ] 1.2 `package/contract/src/source/external-kind.ts`: add `"wiki"` to
  `externalKinds` + `externalKindRegistry` (`suggestedUnitTypes: ["ZONE"]`).
- [ ] 1.3 `package/contract/src/zone/link-target.ts`: extend the
  `external.text` exception comment with the sources/custom boundary.

## 2. App

- [ ] 2.1 New
  `package/app/src/zone/components/sections/SourcesSection.tsx`: list query
  from `@rezics/api/unit-external-ref` filtered to `ctx.zone.unitId`; render
  each ref as a link — label from `sourceSite.entity` translations (fallback
  `sourceSite.key`), href `canonicalUrl`; empty → section's none state.
  Register the kind in `ZoneContentSections.tsx`. Load `rezics-design` before
  the JSX work.
- [ ] 2.2 `package/app/src/zone/components/manage/ZoneSectionListEditor.tsx`
  (+ `zoneManageDraft.ts` if kinds are enumerated there): add the `sources`
  kind — no fields beyond the shared title.
- [ ] 2.3 Verify the list endpoint embeds `sourceSite` (and its `entity`
  labels) in `unit-external-ref.mapper.ts`/`.service.ts`; if entity
  translations are not hydrated, extend the mapper (server-side, small).

## 3. Factory demo

- [ ] 3.1 `package/server/src/db/factory/source-sites.ts`: add
  `ensureFandomSourceSite` following the qidian pattern — refRule
  `externalKind: "wiki"`, `urlTemplate: "https://{externalId}.fandom.com/"`,
  matching `urlMatchPattern`, no crawl support.
- [ ] 3.2 `package/server/src/db/factory/scenarios.ts`: give the toaru zone
  unit a `UnitExternalRef` (`externalId: "toaru"`); replace the quick-links
  Fandom `external` item with a `sources` section in the side column; keep
  one genuine one-off `external` item so that arm stays exercised in the
  fixture.

## 4. Sweep

- [ ] 4.1 Run contract/app/server touched tests, `task check:convention`,
  `task format`; verify `/z/toaru` renders the sources section after
  reseeding (give the user the URL after `task dev`).

## Out of scope

- Sources panels on unit/book/entity detail pages (sibling reader surfaces;
  this section is the first, not the last).
- Crawl integration for fandom; refRule ships `crawlSupported: false`.
- Inline custom items inside the sources section — customs stay in
  collection `external` targets per the boundary decision.
- The naming cutover (`toaru-zone-naming-cutover.md`): its "keep the Fandom
  external link" constraint holds until this plan lands and the item
  migrates into the sources section.
