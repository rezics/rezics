## Why

Rezics needs to record external source identities and source-backed attribution evidence without turning `Unit.extra`, `Book.extra`, or attribution rows into unvalidated source-specific shadow schemas. Publisher links from crawler-backed sources such as Qidian should be resolvable, inspectable, and administrable while continuing to use Entity/Unit as the platform identity model.

## What Changes

- Add a Source Site extension for Entity Units. A source site is represented by an existing Entity/Unit for display identity, while the new extension stores only internal source configuration such as key, crawl support, crawl enablement, adapter key, and validated reference rules.
- Add Unit external references that connect any Unit, including books and Entity Units, to a source site with an external kind, external id, canonical URL, original URL, and observation timestamps.
- Add credit attribution evidence that links a `CreditAttribution(unitId, entityId, role)` row to a Unit external reference and records the source claim path, observed URL, observation time, and optional confidence.
- Add admin management for source sites and source rules using existing Entity identity surfaces instead of duplicating site names, logos, descriptions, or translations.
- Extend read DTOs and frontend attribution interactions so source-backed credit attributions can show an evidence/source preview and actions to view the Entity or open the source URL. Credit attributions without evidence keep the current direct navigation behavior.
- Keep source-specific crawler and URL template details out of arbitrary `extra` fields and validate source reference rules through `@rezics/contract`.

## Capabilities

### New Capabilities

- `source-site-attribution-evidence`: Source-site Entity extensions, Unit external references, credit attribution evidence, source rule validation, admin management, and source-backed attribution preview behavior.

### Modified Capabilities

- None.

## Impact

- Affected packages:
  - `package/contract`: Add SourceSite, UnitExternalRef, credit attribution evidence, and source rule schemas/DTOs.
  - `package/server`: Add Prisma models/migration, source-site APIs/services, external-ref APIs/services, credit attribution evidence persistence, DTO mappers, and crawler scheduling gates.
  - `package/api`: Add source-site and external-ref API clients, query keys, mutations, and typed hooks.
  - `package/admin`: Add source-site administration pages that bind SourceSite rows to existing Entity Units.
  - `package/app`: Add source-backed credit attribution preview behavior on book/detail attribution surfaces.
- Database impact:
  - Adds three canonical tables: `SourceSite`, `UnitExternalRef`, and `CreditAttributionEvidence`.
  - No data migration is required for existing attribution rows; existing rows simply have no evidence until linked.
- API compatibility:
  - Existing credit attribution writes and reads remain valid.
  - New evidence fields are additive and optional.
- Crawler impact:
  - Crawler scheduling must require both source support and operational enablement before jobs are scheduled for a site.
