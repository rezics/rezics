---
title: Collapse Source Schema Into Entity External Links
status: done
created: 2026-06-13
completed: 2026-06-13
supersededBy:
tags: [entity, external-links, source, crawler, schema]
---

## Why

The current source model still treats external links as parser/crawler profiles:
`ExternalRefProfile` owns display identity, URL parsing rules, and crawler flags,
while `UnitExternalRef` stores parser-derived external identities. That makes the
catalog schema carry crawler implementation detail and keeps URL pattern parsing
inside the server.

The product model should be simpler: a Unit has external links, each link points
to a source Entity for i18n display, and the server stores the full URL. Crawler
systems can consume the source Entity id and URL, then do adapter selection,
URL parsing, normalization, extraction, and evidence writes outside the core
server schema. This supersedes [[external-links-read-model]].

## Durable constraints & decisions

- `(type)` `package/server/src/db/schema/source.ts` goes away. The surviving
  external-link table lives with the Entity schema boundary because its
  user-facing source identity is an Entity.
- `(type)` `ExternalRefProfile` and `UnitExternalRef` are deleted rather than
  renamed or kept as compatibility shells. There is no backward-compatible
  SourceSite/Profile/Ref API.
- `(type)` `UnitExternalLink` is the canonical product table for Unit external
  links. It stores `unitId`, `sourceEntityUnitId`, complete `url`, optional
  `labelUnitId`, optional `fallbackText`, product-facing `role`, `sortOrder`,
  timestamps, and any minimal normalized URL/hash fields needed for dedupe.
- `(type)` External-link display resolves platform/source name, avatar, and
  verification through `sourceEntityUnitId -> Entity -> UnitTranslation`.
  Inline text is only a fallback for deliberate one-off labels.
- `(type)` Crawler-facing inputs are source Entity id and full URL. The server
  does not store URL regex rules, external ids, external kinds, crawler adapter
  keys, or crawl enabled/support flags.
- `(comment)` Server URL handling is intentionally generic: validate that a URL
  is a URL, store the complete value, and optionally run non-platform-specific
  normalization for dedupe. Platform URL meaning belongs to crawler/ingestion
  code.
- `(test)` Unit external-link reads support both high-frequency access paths:
  all external links for a Unit, and all links for a Unit scoped to one source
  Entity.
- `(test)` Batch external-link reads hydrate Entity display data in bulk and do
  not fetch profiles, Entities, or translations one link at a time.
- `(test)` Evidence tables that currently point at `UnitExternalRef` point at
  `UnitExternalLink` instead, so attribution and game system facts cite a
  product-visible external link.

## 1. Contract And Schema

- [x] 1.1 Move `UnitExternalLink` from
  `package/server/src/db/schema/source.ts` into
  `package/server/src/db/schema/entity.ts`, rename `displayEntityUnitId` to
  `sourceEntityUnitId`, add role and dedupe fields, and keep Unit/source Entity
  read indexes.
- [x] 1.2 Delete `ExternalRefProfile` and `UnitExternalRef` from the server
  schema, schema row helper exports, schema export tests, and relation builder
  maps.
- [x] 1.3 Update `CreditAttributionEvidence.sourceRefId` and
  `GameSystemRequirement.sourceRefId` to reference `UnitExternalLink.id`
  with names that describe link evidence, not parser source refs.
- [x] 1.4 Replace `package/contract/src/source/` and
  `package/contract/src/unit/external-ref.ts` public shapes with a
  `UnitExternalLink` contract that exposes source Entity display summaries,
  Unit-scoped reads, source-Entity-scoped reads, batch reads, and link writes.
- [x] 1.5 Generate Drizzle migrations from the schema change. Because this is a
  development-stage cutover, migrate useful existing URL rows into
  `UnitExternalLink` and drop profile/ref tables without compatibility views.

## 2. Server Domains

- [x] 2.1 Delete `package/server/src/external-ref-profile/` and remove the
  `/external-ref-profile` mount from `package/server/src/index.ts`.
- [x] 2.2 Replace `package/server/src/unit-external-ref/` with a
  `unit-external-link` domain following `.api.ts`, `.service.ts`, `.mapper.ts`,
  and `.types.ts`.
- [x] 2.3 Remove server URL pattern parsing endpoints:
  `/unit-external-ref/parse-url` and `/unit-external-ref/resolve-url`.
- [x] 2.4 Implement external-link CRUD and display reads that validate Unit and
  source Entity existence, store full URLs, resolve Entity translations in bulk,
  and support `unitId + sourceEntityUnitId` filtering.
- [x] 2.5 Update credit attribution and game system requirement services,
  mappers, APIs, and tests to use the new external-link evidence id.

## 3. Frontend API And App Surfaces

- [x] 3.1 Delete `package/api/src/external-ref-profile/` and replace
  `package/api/src/unit-external-ref/` with first-class
  `unit-external-link` query/mutation helpers.
- [x] 3.2 Keep `package/api/src/unit-external-link/` as the public import path
  and remove its current aliasing through the old external-ref module.
- [x] 3.3 Update app and admin imports that mention SourceSite,
  ExternalRefProfile, UnitExternalRef, `externalKind`, parse-url, or resolve-url
  to the external-link model.
- [x] 3.4 Update external-link editor/display surfaces to require a source
  Entity picker plus URL input; no UI asks users for parser profile ids,
  external ids, external kinds, or raw Entity ids.

## 4. Fixtures And Tests

- [x] 4.1 Replace `package/server/src/db/factory/external-ref-profiles.ts`
  fixtures with Entity-backed `UnitExternalLink` fixtures for Qidian, Fandom,
  and other source examples.
- [x] 4.2 Update seed ordering tests and factory scenarios so external links are
  created after Units and source Entities, without profile/ref dependencies.
- [x] 4.3 Update contract tests for link roles, source Entity display summaries,
  URL storage, Unit-scoped reads, and source-Entity-scoped reads.
- [x] 4.4 Update server service tests for CRUD, bulk hydration, dedupe behavior,
  and evidence foreign-key validation.
- [x] 4.5 Run focused checks for contract, server, API, and convention coverage;
  broaden to `task test` only if the focused checks do not cover the schema
  cutover.

## Out of scope

- Building crawler adapters, crawler scheduling, or crawl result ingestion.
- Server-side platform URL parsing, regex profile storage, or canonical external
  id derivation.
- Backward-compatible API aliases for SourceSite, ExternalRefProfile, or
  UnitExternalRef.
- A generic bookmark manager. These links are Unit metadata and evidence
  sources, not a site-wide link collection.
