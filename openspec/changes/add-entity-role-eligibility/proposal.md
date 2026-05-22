## Why

EntityPicker currently treats a selected attribution role as a search facet over
roles an Entity has already performed. That creates a circular workflow: an
Entity must already be linked to a Unit as `author` before it can be found while
adding an `author`, which hides valid new or underused Entities.

We need a first-class Entity-owned eligibility model that answers "which roles
may this Entity be used for?" separately from attribution rows that answer
"which roles has this Entity actually performed on specific Units?"

## Problem

- `creditRoles` and `subjectRoles` in the `entities` Meili index are derived
  history facets. They are useful for analytics or reverse lookup, but they are
  the wrong predicate for adding a new attribution.
- `Entity.kind` is too coarse to enforce role validity. A `character` should not
  be linkable as a real-world `author`, but `kind` alone cannot express all
  product exceptions or user-managed policy.
- The frontend needs role suggestions during Entity creation, but those
  suggestions must not become hidden backend defaults that drift when registry
  rules change.
- Seed data should populate role eligibility and synchronize seeded Entities to
  Meilisearch so EntityPicker behavior is testable from seeded environments.

## Goals

- Add explicit Entity role eligibility for credit and subject attribution roles.
- Use `Entity.kind` only as a frontend creation-time suggestion source for
  initial eligibility values.
- Enforce eligibility in credit and subject attribution link APIs.
- Update EntityPicker to search/filter by eligibility instead of actual
  attribution history.
- Remove `creditRoles` and `subjectRoles` from the Entity search document and
  Meili filter surface unless another future change reintroduces actual-role
  history for a specific analytics use case.
- Update seed/factory data to populate eligibility and sync seeded Entities to
  Meilisearch.

## Non-goals

- Do not replace `CreditAttribution` or `SubjectAttribution`; they remain the
  source of truth for actual Unit-to-Entity relationships.
- Do not infer eligibility from `Entity.kind` on every read or write.
  Frontend creation may prefill eligibility from kind, but persisted eligibility
  is explicit and user-managed after creation.
- Do not introduce arbitrary custom role keys for public users. Eligibility uses
  existing registry-backed credit and subject role keys.
- Do not add a historical "actual roles performed" Entity search feature in
  this change.

## What Changes

- Add persistent `Entity.eligibleCreditRoles` and
  `Entity.eligibleSubjectRoles` arrays for registered role keys.
- Extend entity create/update contracts, DTOs, mappers, services, and tests to
  read and write eligibility.
- Add server validation so `CreditAttributionService.link` rejects a credit role
  not present in the target Entity's `eligibleCreditRoles`, and
  `SubjectAttributionService.link` rejects a subject role not present in
  `eligibleSubjectRoles`.
- Update the `entities` Meili document to include eligibility arrays and remove
  actual-role arrays/counts from the document shape.
- Update EntityPicker search options and implementation to use eligibility role
  filters for add flows while still passing the selected role to the caller for
  persistence.
- Update inline Entity creation UI to prefill eligibility from the selected
  kind's suggestions while allowing users to manage the arrays.
- Update seed/factory scenarios to assign eligibility to seeded Entities and
  trigger Entity Meili synchronization.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `entity-unit-type`: Entity records gain explicit persisted role eligibility.
- `entity-service`: Entity CRUD schemas and service behavior include
  eligibility fields.
- `entity-search-index`: Entity search documents and filters use eligibility
  instead of actual attribution role facets.
- `entity-picker`: Picker role selection becomes an eligibility search
  predicate and creation-time eligibility prefill source.
- `attribution`: Credit attribution linking validates Entity credit
  eligibility.
- `subject-attribution`: Subject attribution linking validates Entity subject
  eligibility.
- `infra-seed`: Seed/factory flows populate Entity eligibility and sync seeded
  Entity documents to Meilisearch.
- `seed-factory-scenarios`: Factory Meili targeted sync includes Entity search
  documents for manifest entries representing Entities.

## Scope

Affected packages:

- `package/contract`: Entity DTO/input/search schemas and role registry helper
  types.
- `package/server`: Prisma schema/migration, Entity service/API, credit and
  subject attribution validation, Meili search service, seed/factory sync.
- `package/search`: Entity search document builder, sync routines, Meili index
  settings, tests.
- `package/api`: Entity API client query/mutation types.
- `package/app`: EntityPicker, inline create form, and attribution editing
  flows that consume the picker.
- `openspec/specs`: Requirement deltas for the capabilities above.

## Impact

- **Database**: Adds eligibility arrays to `Entity`. Existing rows need a
  migration/backfill based on current `kind` suggestions or conservative empty
  arrays, with seed data explicitly updated.
- **API**: Entity create/update/list/search DTOs include eligibility fields.
  Attribution link endpoints may newly reject links that were previously
  accepted when the Entity lacks the selected role eligibility.
- **Search**: `entities` index settings and documents change. A full entity
  index resync is required after deployment.
- **Frontend**: EntityPicker search semantics change from actual-role history to
  eligibility. Inline creation gains eligibility controls or prefilled state
  managed by the form.
- **Backward compatibility**: Existing clients that rely on `creditRoles` or
  `subjectRoles` in Entity search responses must migrate to attribution APIs or
  the new eligibility fields. Existing attribution data remains valid but may
  expose rows whose Entities lack matching eligibility until the migration or
  cleanup task reconciles them.
