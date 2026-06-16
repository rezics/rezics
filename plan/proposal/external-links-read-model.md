---
title: External Links Read Model
status: superseded
created: 2026-06-12
completed:
supersededBy: [[collapse-source-schema-into-entity-external-links]]
tags: [external-links, entity, source, api, app]
---

## Why

External links are a common metadata surface: detail pages, editors, zone source
sections, cards, and admin tools all need to show every external presence for a
Unit with the linked platform/channel name and avatar. The current SourceSite
shape couples parser identity, display identity, and external-reference storage
too tightly: `key` is API-only but can leak into rendering, and one
`SourceSite.entityUnitId` cannot cleanly represent multiple parser profiles that
share one display Entity or profiles that must display as different Entities
under the same platform.

Rework the model around a high-frequency display read path. Entity owns
language and display identity; external-ref profiles own parsing/crawling;
UnitExternalRef owns structured external identity; plain external links own
navigation that is not structured enough to parse, dedupe, or crawl.

## Durable constraints & decisions

- `(type)` Replace SourceSite-as-display-identity with an
  `ExternalRefProfile` shape. Profile keys are unique API identifiers only and
  are never a user-facing label.
- `(type)` `ExternalRefProfile` carries `displayEntityUnitId` for rendering and
  may carry `platformEntityUnitId` for grouping. Multiple profiles may share one
  display Entity, and profiles under the same platform may display as different
  Entities.
- `(test)` External ref rendering resolves names and avatars through the
  profile display Entity, not through profile keys.
- `(test)` URL submission is parsed and canonicalized server-side even when the
  frontend performed a preview match.
- `(comment)` Frontend URL matching is only a responsive preview; backend
  profile rules and canonical URL derivation are authoritative.
- `(type)` `UnitExternalRef` stores `externalRefProfileId`, `externalKind`,
  `externalId`, canonical/original URL fields, timestamps, and ordering fields
  as needed for display. Its unique identity is profile plus external kind plus
  external id.
- `(type)` Plain external links are a separate model from structured external
  refs. They may use `labelUnitId` or `displayEntityUnitId` for i18n display,
  and only fall back to inline text for deliberate one-off labels.
- `(test)` `GET /unit/:unitId/external-links` returns display-ready structured
  refs and plain links in one response with resolved Entity name/avatar for the
  viewer language chain.
- `(test)` Unit external-link reads use `unitId`-scoped indexes and batched
  hydration; frontend callers do not compose refs by listing refs then fetching
  profiles and Entities one by one.
- `(test)` Batch reads support multiple Units without one HTTP request per Unit.

## 1. Contract And Schema

- [x] 1.1 Add contract schemas for `ExternalRefProfile`, profile ref rules,
  profile list/query/resolve payloads, and display Entity summaries under
  `package/contract/src/source/` or a renamed external-ref domain.
- [x] 1.2 Replace SourceSite contract exports with ExternalRefProfile exports in
  `package/contract/src/index.ts` and downstream package entrypoints.
- [x] 1.3 Update server Drizzle schema in `package/server/src/db/schema/source.ts`
  to split parser profiles from display Entities: profile primary key, unique
  `key`, `displayEntityUnitId`, optional `platformEntityUnitId`, crawl fields,
  and profile rules.
- [x] 1.4 Change `UnitExternalRef` schema from `sourceSiteEntityUnitId` to
  `externalRefProfileId`, add display ordering if missing, and keep indexes for
  `unitId` reads and profile/external identity lookups.
- [x] 1.5 Add a plain external-link schema/table for non-structured URLs with
  `unitId`, `url`, optional `labelUnitId`, optional `displayEntityUnitId`,
  optional fallback text, and ordering.
- [x] 1.6 Generate Drizzle migrations from schema changes; do not hand-author
  ordinary migration SQL.

## 2. Server APIs

- [x] 2.1 Replace `package/server/src/source-site/` with an
  ExternalRefProfile domain following `{domain}.api.ts`, `.service.ts`,
  `.mapper.ts`, and `.types.ts`.
- [x] 2.2 Replace `package/server/src/unit-external-ref/` inputs and service
  logic to create/update refs through `externalRefProfileId` and server-side URL
  canonicalization.
- [x] 2.3 Add URL resolve API that normalizes host, finds at most 20 matching
  profiles by host/profile rule, parses identity, and returns existing bound
  UnitExternalRef when one exists.
- [x] 2.4 Add a Unit-scoped external-links read API returning display-ready
  structured refs and plain links with resolved names, avatars, platform
  summaries, external kind labels or keys, URLs, and ids needed by editors.
- [x] 2.5 Add a batch external-links read API for card/list surfaces that
  need external-link summaries for multiple Units.
- [x] 2.6 Keep low-level admin/list APIs for profile maintenance, but route app
  rendering through the unit external-links read API.
- [x] 2.7 Update `package/server/src/index.ts` mounts to use the new domains.

## 3. Frontend API Package

- [x] 3.1 Replace `package/api/src/source-site/` with external-ref-profile query
  and mutation helpers.
- [x] 3.2 Update `package/api/src/unit-external-ref/` to use profile ids and the
  new URL resolve endpoint.
- [x] 3.3 Add `package/api/src/unit-external-link/` read queries for single
  Unit and batch display-ready external-link data.
- [x] 3.4 Ensure query keys separate profile admin data, structured ref writes,
  and display read models.

## 4. App UX

- [ ] 4.1 Build a shared `ExternalLinksEditor` component with two sections:
  user-facing "Platform identities" for structured refs and "Related links" for
  plain links.
- [ ] 4.2 In the structured add flow, support either choosing an Entity/profile
  first or pasting a URL first; URL-first should resolve host/profile matches and
  auto-fill the display Entity when possible.
- [ ] 4.3 Render existing structured refs with display Entity name/avatar,
  external-kind label, canonical URL, open-link action, and remove action.
- [ ] 4.4 Render plain links under the structured refs and allow unresolved URLs
  from the structured flow to be converted into plain links.
- [x] 4.5 Update `package/app/src/zone/components/sections/SourcesSection.tsx`
  to read from the unit external-links display API instead of listing
  UnitExternalRef directly.
- [ ] 4.6 Update entity/book/media editor surfaces that manage external refs to
  use the shared component instead of custom SourceSite/UnitExternalRef wiring.

## 5. Tests And Fixtures

- [x] 5.1 Update contract tests for profile keys, display Entity ids, URL rule
  parsing, and plain external-link shapes.
- [ ] 5.2 Update server service tests for URL resolve, create/update
  canonicalization, unit display read model hydration, and batch read behavior.
- [x] 5.3 Update API package tests for route paths, query keys, and invalidation.
- [ ] 5.4 Update app model/component tests for display labels, URL-first add
  states, unmatched URL fallback, and remove actions.
- [x] 5.5 Update factory fixtures in
  `package/server/src/db/factory/external-ref-profiles.ts`
  to seed ExternalRefProfile examples such as Qidian book/publisher and Fandom
  wiki profiles.

## Out of scope

- Crawler implementation beyond preserving profile crawl configuration.
- Backward-compatible SourceSite endpoints or field aliases.
- A generic browser bookmark manager. Plain external links are Unit metadata,
  not a site-wide link database.
- Search ranking changes for Entity full-text search, except what the external
  link editor needs to select display Entities or profiles.
