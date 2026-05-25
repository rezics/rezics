## Context

Credit attribution currently stores only the canonical relationship between a Unit and an Entity Unit: `(unitId, entityId, role, sortOrder)`. This is correct for authors, publishers, studios, and similar production credits, but it does not record where a crawler or editor observed the claim.

The catalog already uses Unit/Entity as the identity spine. Source sites such as Qidian should therefore be Entities, not a parallel site model with duplicate names, logos, descriptions, or translations. Source-specific details such as URL templates and crawler enablement are operational configuration attached to that Entity.

The repository also has a clear boundary against using `extra` JSON as a source-specific shadow schema for identity, deduplication, public contracts, or query behavior. This change keeps external identities and evidence in typed tables while allowing small validated source-rule configuration on the SourceSite extension.

## Goals / Non-Goals

**Goals:**

- Represent source sites as Entity Units with a thin `SourceSite` extension for internal source configuration.
- Store external identities for any Unit through a source-site-scoped reference table.
- Store evidence for credit attributions with strict linkage to existing `CreditAttribution` rows.
- Allow admin users to create and manage source-site configuration without duplicating Entity display data.
- Allow app users to inspect source-backed credit attributions and still navigate directly when no evidence exists.
- Gate crawler scheduling through both source support and operational enablement.

**Non-Goals:**

- Do not introduce a separate display model for source sites.
- Do not store source-specific book ids or publisher ids in `Unit.extra`, `Book.extra`, or attribution `extra`.
- Do not build a generic evidence table for all attribution types in phase 1.
- Do not implement crawler adapters or raw crawler payload storage in this change.
- Do not require backfilling evidence for existing attribution rows.

## Decisions

### SourceSite is an Entity extension

`SourceSite` uses `entityUnitId` as its primary key and foreign key to `Entity.unitId`. Display data remains owned by the Entity Unit:

```txt
Unit / Entity / UnitTranslation
  slug, title, summary, avatar, verified, kind

SourceSite
  entityUnitId
  key
  crawlSupport
  crawlEnabled
  crawlerAdapterKey
  refRules
```

The `key` is an internal stable key such as `qidian`; it is not a display name. This keeps source sites compatible with existing Entity detail, EntityPicker, translations, avatars, slugs, and admin Entity workflows.

Alternatives considered:

- Standalone `SourceSite(name, logo, description, homepageUrl)`: rejected because it duplicates Unit/Entity infrastructure.
- Store source configuration in `Entity.extra`: rejected because crawl gates, source keys, and ref rules are product behavior and need validation.

### Use one UnitExternalRef table for books and entities

`UnitExternalRef` stores source identities for any Unit, including Book Units and Entity Units. This avoids separate `BookExternalRef` and `EntityExternalRef` tables while preserving a single Unit identity boundary.

Suggested fields:

```txt
id
unitId
sourceSiteEntityUnitId
externalKind
externalId
canonicalUrl
originalUrl
firstSeenAt
lastSeenAt
```

Suggested uniqueness:

- `(sourceSiteEntityUnitId, externalKind, externalId)` is unique for source-issued ids.
- `(unitId, sourceSiteEntityUnitId, externalKind)` may be unique when the source kind allows only one ref per Unit. If a source can expose multiple refs for the same kind, enforce multiplicity in service validation instead of a broad unique constraint.

`externalKind` remains a string to avoid migrations for every new source shape, but public writes should validate it against source `refRules`.

### CreditAttributionEvidence is strict, not generic

The evidence table targets `CreditAttribution` only:

```txt
CreditAttributionEvidence
  id
  unitId
  entityId
  role
  sourceRefId
  claimPath
  observedUrl
  observedAt
  confidence
```

It should reference `CreditAttribution(unitId, entityId, role)` and `UnitExternalRef(id)`. This avoids weak polymorphic foreign keys. If subject attribution evidence becomes necessary later, add a separate `SubjectAttributionEvidence` table with its own strict FK.

Alternatives considered:

- Generic `AttributionEvidence(attributionType, unitId, entityId, role)`: rejected because it cannot strictly reference both `CreditAttribution` and `SubjectAttribution`.
- `CreditAttribution.extra.source`: rejected because evidence is queryable public behavior and should be typed.

### Source rule configuration is validated JSON

`SourceSite.refRules` may be JSON because it is small, source-scoped operational configuration rather than canonical catalog data. It must be validated by `@rezics/contract` on all writes.

Rules can describe:

- `externalKind`
- `externalIdName`
- URL templates
- URL match patterns
- crawler action key
- whether this kind supports crawl

Source-specific observed ids remain in `UnitExternalRef`, not inside `refRules`.

### Crawl support and enablement are separate

Use separate support and runtime gates:

```txt
crawlSupport: "none" | "planned" | "supported" | "deprecated"
crawlEnabled: boolean
crawlerAdapterKey: string | null
```

Derived behavior:

```txt
supportsCrawl = crawlSupport == "supported" && crawlerAdapterKey != null
canScheduleCrawl = supportsCrawl && crawlEnabled
```

This distinguishes "Rezics has no adapter", "adapter exists but is paused", and "adapter exists and may schedule jobs".

### Admin owns configuration, app owns display preview

Admin pages should manage SourceSite rows and ref rules through existing Entity selection/creation. They should display Entity-derived title/avatar/slug, but write only SourceSite configuration fields.

App attribution surfaces should render source-backed credit rows with an accessible preview interaction:

- no evidence: direct Entity navigation continues
- evidence exists: open a hover/focus/tap preview with Entity summary, role, source Entity, source URL, and actions

Use existing shadcn primitives and `SafeLink` for outbound URLs. Do not use raw `<a href>`.

## Risks / Trade-offs

- `refRules` JSON can become a hidden schema -> Mitigate with contract schemas, admin validation, and a rule that observed ids/URLs live only in `UnitExternalRef`.
- Source `externalKind` vocabulary can drift -> Mitigate with per-source rule validation and centralized labels/helpers in `@rezics/contract`.
- Evidence can disagree across sources -> Allow multiple evidence rows per credit attribution and keep canonical `CreditAttribution` separate from evidence.
- Crawler status can be misunderstood -> Expose both support and enablement in admin UI and derive schedule eligibility explicitly.
- UI preview can interfere with navigation -> Preserve direct navigation for no-evidence rows and provide explicit "View Entity" / "Open Source" actions when evidence exists.
- Strict credit-only evidence may need future subject support -> Add `SubjectAttributionEvidence` later rather than weakening phase 1 referential integrity.

## Migration Plan

1. Add contract schemas and DTOs for source-site configuration, Unit external refs, and credit attribution evidence.
2. Add Prisma models and migration for `SourceSite`, `UnitExternalRef`, and `CreditAttributionEvidence`.
3. Add server APIs/services/mappers and tests for source-site management, external refs, evidence linking, and crawl gate derivation.
4. Add `@rezics/api` clients, query keys, mutations, and hooks.
5. Add admin pages for SourceSite configuration using existing Entity identity surfaces.
6. Extend credit attribution read DTOs and app attribution UI to include optional evidence preview behavior.
7. Add a seed/factory example for Qidian as a SourceSite Entity plus book external ref and publisher credit evidence.

Rollback strategy:

- Since fields are additive and existing attribution rows do not depend on evidence, app/admin usage can be disabled by hiding routes and not emitting evidence in DTOs.
- Database rollback is a normal development-stage migration rollback before production data depends on the new tables.

## Open Questions

- Should admin support per-rule crawl enablement in phase 1, or is SourceSite-level `crawlEnabled` enough until multiple external kinds are actively crawled?
- Should `canonicalUrl` be required on `UnitExternalRef`, or can it be derived lazily from `refRules` when `externalId` and a template are present?
- Should source-site keys be globally immutable after creation, or only admin-editable before any external refs exist?
