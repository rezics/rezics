## Context

Entity identity search currently indexes `creditRoles` and `subjectRoles` as
reverse attribution facets derived from `CreditAttribution` and
`SubjectAttribution` rows. EntityPicker also uses the selected role as a search
filter. That mixes two facts:

- eligibility: which roles an Entity may be used for
- history: which roles an Entity has already performed on specific Units

The target design moves add-flow search and server validation to explicit
Entity-owned eligibility arrays. Actual attribution rows remain the source of
truth for Unit-to-Entity relationships and are queried through attribution APIs.

## Goals / Non-Goals

**Goals:**

- Store explicit `eligibleCreditRoles` and `eligibleSubjectRoles` on Entity.
- Treat `Entity.kind` as a frontend creation-time suggestion source, not a
  backend default or read-time derivation.
- Enforce eligibility when linking credit or subject attributions.
- Search EntityPicker candidates by eligibility.
- Remove actual-role history facets from the Entity search document.
- Populate eligibility and synchronize entity search docs in seed/factory flows.

**Non-Goals:**

- Do not change the attribution table primary keys or actual relationship
  semantics.
- Do not support custom public role keys outside the existing registries.
- Do not infer eligibility from kind after creation.
- Do not add historical role analytics to the Entity search index.

## Decisions

### Persist eligibility on Entity

Add `eligibleCreditRoles` and `eligibleSubjectRoles` to the Entity extension row.
PostgreSQL text arrays map naturally to Prisma `String[]`, keep writes scoped to
the Entity aggregate, and avoid a junction table while the role lists are small.

Alternatives considered:

- Junction table per eligibility type: more normalized, but heavier for the
  current bounded registry arrays and unnecessary unless eligibility needs
  per-role metadata.
- Derive from `kind` on read: cheaper storage, but cannot support manual
  add/remove and makes role policy silently change when registry hints change.

### Registry helpers provide creation suggestions only

Role registries already expose `entityKindHints`. The frontend should add helper
logic that maps a selected kind to suggested eligible roles when creating an
Entity. The created payload persists those arrays explicitly. Later kind edits
do not automatically rewrite eligibility.

Alternatives considered:

- Backend default fill from kind: simpler create payloads, but hides product
  policy and makes migration/backfill behavior implicit.
- No suggestions: semantically clean, but forces users to manually fill common
  role arrays and makes inline creation slower.

### Search indexes eligibility, not actual roles

The `entities` index should include `eligibleCreditRoles` and
`eligibleSubjectRoles` as filterable attributes. EntityPicker sends these
filters for add flows. The index should drop `creditRoles`, `creditUnitTypes`,
`subjectRoles`, `subjectUnitTypes`, `creditCount`, and `subjectCount` from Entity
documents.

Actual role history can still be obtained from credit/subject attribution APIs.
If a later analytics use case needs historical role facets, it should introduce
that search surface explicitly instead of overloading EntityPicker behavior.

Alternatives considered:

- Keep both eligibility and actual-role facets: maximal data, but extra sync
  work on every attribution mutation and continued semantic ambiguity.
- Do not index eligibility: simpler Meili settings, but first-page EntityPicker
  results can be dominated by ineligible Entities.

### Link APIs enforce eligibility

`CreditAttributionService.link` and `SubjectAttributionService.link` must load
the target Entity eligibility and reject disallowed roles with typed errors.
Schema validation continues to reject unregistered role keys before service
logic runs.

Existing data may contain attributions whose Entities lack matching eligibility
until migration/backfill completes. Read paths should continue to display those
rows; enforcement applies to new link writes.

### Seed and factory flows sync entity documents

Seeded Entities need explicit eligibility so picker behavior is meaningful in
development environments. Factory `init-and-sync` mode should include Entity
sync targets in the manifest and synchronize seeded Entity documents after
database seeding.

## Risks / Trade-offs

- **Migration may produce overly broad eligibility** -> Backfill from kind-based
  creation suggestions and keep the arrays editable so maintainers can narrow
  exceptional Entities later.
- **Existing invalid attribution rows remain visible** -> Do not block reads;
  add an audit or cleanup task to find attributions whose role is absent from
  eligibility after backfill.
- **Eligibility filter may hide incorrectly configured Entities** -> Inline
  create and entity edit surfaces must expose manageable eligibility controls.
- **Meili schema change requires resync** -> Run entity index init/settings
  update followed by full entity sync after deployment or factory seeding.

## Migration Plan

1. Add nullable/defaulted eligibility arrays to `Entity`.
2. Backfill existing Entities from kind-based creation suggestions.
3. Update contracts, services, mappers, and search document schemas.
4. Reinitialize/update the `entities` Meili index settings.
5. Full-sync Entity documents.
6. Enable attribution link enforcement.

Rollback: keep attribution tables unchanged. If rollback is required, old
clients can ignore eligibility fields, but the Meili entity index must be
reinitialized to the previous document shape before old search clients rely on
actual-role facets again.

## Open Questions

- Should non-admin users be allowed to edit eligibility on Entities they own, or
  should eligibility edits use the same collaborative metadata permission gates
  as other shared Entity fields?
- Should migration backfill preserve every existing actual attribution role as
  eligible even when kind suggestions would not include it, or should those be
  reported as cleanup candidates?
