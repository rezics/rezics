# Catalog capabilities

Rezics uses Unit as shared identity and adds subtype data only when a product
needs distinct fields or behavior. This document owns the complete catalog
journey across the Unit, entity, Book, Media, Software, Series, Release,
localization, attribution, relationship, variant, slug, and source boundaries.

Planning context:

- [Outline: Unit](https://outline.rezics.com/doc/unit-432rqxfMbA)
- [Outline: catalog Unit](https://outline.rezics.com/doc/catalog-unit-QrDjYrqvQ3)
- [Outline: entity and source](https://outline.rezics.com/doc/entity-source-boYHUwxsGB)
- [Outline: Series](https://outline.rezics.com/doc/series-OnoitSZQ3t)

The implementation owners are `services/main/src/services/units`,
`services/main/src/services/api/units`,
`services/main/src/services/api/domain-extensions`,
`services/main/src/services/database/schema`, and
`apps/web/features/units`.

## Shared Unit contract

```progress
id: catalog.unit-lifecycle
status: open
goal: Let people create, find, read, edit, publish, protect, and retire each supported Unit kind through one coherent lifecycle.
depends:
  - access.unit-collaboration
  - localization.application-and-content
accept:
  - Unit identity, kind, status, visibility, ownership, protection, timestamps, and subtype existence cannot contradict one another.
  - Create, detail, edit, publication, soft-deletion, restoration, and permanent lifecycle actions use live server contracts and exact permissions.
  - Public, private, unlisted, draft, deleted, and unavailable Units have consistent API, route, feed, search, and history behavior.
verify:
  - Run the Unit schema, lifecycle, status, visibility, API, and web management tests.
  - Exercise every supported Unit kind and lifecycle transition with allowed and denied callers.
```

```progress
id: catalog.localized-metadata
status: open
goal: Let one Unit carry trustworthy metadata versions for every supported language without duplicating its identity.
depends:
  - catalog.unit-lifecycle
accept:
  - Titles, descriptions, aliases, media, and source-language facts have one typed localization contract across storage, API, search, and UI.
  - Creation and editing preserve source language, requested language, fallback provenance, and independent localized media.
  - Missing, duplicate, invalid, and deleted language versions cannot silently replace another language.
verify:
  - Run Unit localization, alias, i18n service, content-language, media-fallback, and search projection tests.
  - Create a multilingual Unit and verify exact, fallback, update, deletion, feed, and search behavior.
```

The separate distinction between metadata languages and languages supported by
the content itself is tracked by `content.capability-languages` beside the
localization schema.

```progress
id: addressing.public-unit-slugs
status: open
goal: Give Units optional stable human-facing addresses while immutable Unit IDs remain the only identity.
depends:
  - catalog.unit-lifecycle
accept:
  - Scoped slug assignment, lookup, history, redirect, release, and reuse follow `docs/architecture/unit-slug-addressing.md`.
  - Public routes support canonical slug addresses and ID fallback without confusing scope, kind, or content-language segments.
  - Conflicts, stale mappings, unauthorized changes, and deleted targets fail deterministically.
verify:
  - Run the slug library, slug service, slug-address API, server resolver, route, and form tests.
  - Exercise assignment, conflict, rename, old-link redirect, deletion, and canonical URL behavior for each public scope.
```

```progress
id: catalog.credits-and-attributions
status: open
goal: Represent authorship, publication, contribution, and credit with reviewable relationships between Units and entities.
depends:
  - catalog.unit-lifecycle
accept:
  - Credit roles, ordering, requested attributions, provenance, and acceptance state preserve the credited party and target Unit.
  - Authorized editors can add, update, remove, request, and confirm attributions without impersonating the credited entity.
  - Detail, edit, feed, and history surfaces show the same accepted credit meaning.
verify:
  - Run attribution authorization, role, request-confirmation, draft, API, and Unit presentation tests.
  - Exercise direct credit, requested confirmation, refusal, ordering, deletion, and unauthorized mutation cases.
```

```progress
id: catalog.subject-associations
status: open
goal: Let people propose and curate typed relationships among works, entities, Releases, Series, and other Units.
depends:
  - catalog.unit-lifecycle
accept:
  - Relationship kinds, direction, subject and object roles, evidence, state, and ordering have one server-owned contract.
  - Proposals can be reviewed without creating duplicate, self-contradictory, cross-kind, or unauthorized associations.
  - Unit detail and management surfaces distinguish direct, inferred, proposed, accepted, and removed relationships.
verify:
  - Run association-context, proposal, Unit relationship, domain-extension, and API tests.
  - Exercise propose, accept, reject, duplicate, inverse, invalid-kind, and concurrent-review cases.
```

```progress
id: catalog.main-and-variants
status: open
goal: Relate equivalent Unit variants to a community-selected main Unit without moving interactions or identity between them.
depends:
  - catalog.unit-lifecycle
accept:
  - Main and variant Units retain the same independent publishing, discussion, collection, tag, review, and progress capabilities.
  - Variant links are kind-safe, acyclic, concurrency-safe, and can change through an auditable governance action.
  - Product surfaces may recommend the main Unit but never silently redirect or attach a variant's interactions to it.
verify:
  - Run variant schema, policy, service, API, routing, collection, tag, review, and progress tests.
  - Exercise link, unlink, conflicting main, cycle, cross-kind, and independent-interaction cases.
```

```progress
id: catalog.source-links
status: open
goal: Record authoritative external sources and identifiers for a Unit independently from credit attribution.
depends:
  - catalog.unit-lifecycle
accept:
  - A source link records the target Unit, source entity, canonical URL or external identifier, kind, and review state without claiming authorship.
  - Duplicate normalization, redirects, dead links, conflicting identifiers, and source removal have explicit behavior.
  - Source links can support provenance and future import resolution without replacing the Rezics Unit identity.
verify:
  - Run source-link schema, normalization, authorization, API, and Unit presentation tests.
  - Exercise add, duplicate, conflict, redirect, unavailable source, and removal cases.
```

```progress
id: catalog.external-source-resolution
status: open
goal: Resolve a supported external URL to an existing or proposed Rezics Unit before a person saves a bare link.
depends:
  - catalog.source-links
accept:
  - Supported providers normalize URLs and identifiers through provider-specific, versioned parsers.
  - Resolution returns an existing Unit, a reviewable candidate, or an explicit unsupported result without silently creating duplicates.
  - Import respects provider terms, request limits, provenance, localization, authorization, and retry safety.
verify:
  - Run provider contract, normalization, matching, rate-limit, provenance, and duplicate-resolution tests.
  - Exercise supported, ambiguous, duplicate, rate-limited, unavailable, and unsupported URLs end to end.
```

## Catalog products

```progress
id: catalog.books
status: open
goal: Provide a complete Book catalog journey for bibliographic metadata, editions, contents, credits, releases, and reading.
depends:
  - catalog.localized-metadata
  - catalog.credits-and-attributions
  - catalog.subject-associations
accept:
  - Book creation and editing cover the v1 bibliographic contract with localized metadata, cover, credits, license, relationships, and publication state.
  - Book detail presents the correct edition or variant identity, contents, discussions, reviews, collections, progress, tags, and related Units.
  - Hosted Book content is available only when the separate platform content-license marker and publication rules allow it.
verify:
  - Run Book schema, Unit API, content-license, content-structure, reader, detail, and management tests.
  - Complete a Book create-to-read journey with and without hosted-content permission.
```

```progress
id: catalog.media
status: open
goal: Provide a complete Media catalog journey for films, television, and albums without conflating individual video or audio assets.
depends:
  - catalog.localized-metadata
  - catalog.credits-and-attributions
  - catalog.subject-associations
accept:
  - Media creation and editing cover the approved v1 kinds, metadata, credits, releases, relationships, and publication state.
  - Media detail presents contents, discussions, reviews, collections, progress, tags, and related Units with media-appropriate progress semantics.
  - Unsupported individual video and music identities are rejected or represented through an approved existing type.
verify:
  - Run Media schema, API, content-structure, progress-estimate, detail, and management tests.
  - Complete one film, television-series, and album journey and verify unsupported-kind behavior.
```

```progress
id: catalog.software
status: open
goal: Provide a complete Software catalog journey for applications, games, websites, extensions, and mods.
depends:
  - catalog.localized-metadata
  - catalog.credits-and-attributions
  - catalog.subject-associations
accept:
  - Software identity, kind tags, supported platforms, releases, requirements, credits, sources, and publication state use explicit contracts.
  - Version and platform requirements can be created, validated, searched, and presented without free-form ambiguity.
  - Software detail supports discussions, reviews, collections, progress, tags, releases, and related Units.
verify:
  - Run Software schema, domain-extension API, requirements, release, search, detail, and management tests.
  - Complete application, game, website, extension, and mod journeys with valid and invalid requirements.
```

```progress
id: catalog.series-and-releases
status: open
goal: Let communities organize Units into Series and publish concrete Release Units without inventing a second work identity.
depends:
  - catalog.subject-associations
accept:
  - Series membership is many-to-many, ordered where needed, and keeps each member's independent Unit identity.
  - A Release represents a concrete published version for supported catalog products with version, date, platform, and relationship data.
  - Main and variant pages present direct and inherited Series or Release context without relocating discussions or other interactions.
verify:
  - Run Series, Release, association, ordering, API, feed, and Unit presentation tests.
  - Exercise Series membership and Software Release creation, reordering, variant presentation, and removal.
```

## Catalog milestone

```progress
id: catalog.v1-experience
status: open
goal: Make the v1 Rezics catalog trustworthy from creation and curation through discovery and use.
depends:
  - platform.v1-foundation
  - catalog.unit-lifecycle
  - catalog.localized-metadata
  - addressing.public-unit-slugs
  - catalog.credits-and-attributions
  - catalog.subject-associations
  - catalog.main-and-variants
  - catalog.source-links
  - catalog.books
  - catalog.media
  - catalog.software
  - catalog.series-and-releases
  - content.capability-languages
  - legal.unit-content-license
accept:
  - Book, Media, Software, Series, Release, Entity, Label, and shared Unit journeys agree on identity, localization, access, source, and lifecycle meaning.
  - Public catalog pages use live data and preserve the same Unit identity across routes, feeds, search, collections, discussions, reviews, tags, and progress.
  - Catalog failures are bounded, recoverable, and covered at the storage, API, and user-journey boundaries.
verify:
  - Run the catalog-related schema, service, API, generated-client, and web feature tests.
  - Execute the catalog acceptance matrix from clean creation through public discovery for every v1 catalog kind.
```
