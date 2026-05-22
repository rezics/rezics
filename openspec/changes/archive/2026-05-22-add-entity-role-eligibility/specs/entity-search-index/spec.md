## MODIFIED Requirements

### Requirement: Entities index document

The system SHALL maintain a dedicated Meilisearch index named `entities` whose primary key is `id` and whose document represents searchable Entity identity and role eligibility. The document SHALL include `id`, `unitId`, `kind`, `verified`, `slug`, `ownerUnitId`, `avatar`, `titles`, `summaries`, `translations`, `eligibleCreditRoles`, `eligibleSubjectRoles`, `createdAt`, and `updatedAt`. The document SHALL NOT include actual attribution-history role facets such as `creditRoles`, `creditUnitTypes`, `subjectRoles`, `subjectUnitTypes`, `creditCount`, or `subjectCount`.

#### Scenario: Entity document contains identity and avatar

- **WHEN** an Entity with `avatar = "https://cdn.example/liu.png"` and translated titles is synced
- **THEN** the `entities` document SHALL include the same avatar URL
- **AND** the document SHALL include all translated titles in `titles`
- **AND** the document SHALL include structured translations for result rendering

#### Scenario: Entity document contains eligibility facets

- **WHEN** an Entity has `eligibleCreditRoles = ["author"]` and `eligibleSubjectRoles = ["about"]`
- **THEN** the `entities` document SHALL include `"author"` in `eligibleCreditRoles`
- **AND** it SHALL include `"about"` in `eligibleSubjectRoles`
- **AND** it SHALL NOT derive role arrays from existing CreditAttribution or SubjectAttribution rows

### Requirement: Entities index does not store related Unit id arrays

The `entities` index SHALL NOT store arrays of Units related to the Entity, including `creditedUnitIds` or `subjectUnitIds`. Entity work/subject detail pages SHALL load related Units through attribution/content APIs rather than from the entity search document. The document SHALL expose eligibility arrays for picker filtering, not actual relationship counts or related Unit identifiers.

#### Scenario: Related Unit ids are excluded

- **WHEN** an Entity is linked to many Units through CreditAttribution and SubjectAttribution
- **THEN** the `entities` document SHALL expose `eligibleCreditRoles` and `eligibleSubjectRoles`
- **AND** it SHALL NOT contain `creditedUnitIds`
- **AND** it SHALL NOT contain `subjectUnitIds`
- **AND** it SHALL NOT contain actual attribution counts

### Requirement: Entities index settings support identity search and eligibility facets

The search client SHALL configure the `entities` index with searchable identity fields and filterable registry-backed eligibility facets. Searchable attributes SHALL include at least `titles`, `summaries`, and `slug`. Filterable attributes SHALL include `kind`, `verified`, `ownerUnitId`, `eligibleCreditRoles`, and `eligibleSubjectRoles`. Sortable attributes SHALL include `createdAt` and `updatedAt`.

#### Scenario: Search filters by credit eligibility

- **WHEN** an EntityPicker query filters `eligibleCreditRoles = "author"`
- **THEN** Meilisearch SHALL accept the filter
- **AND** only entities eligible for the author credit role SHALL be returned

#### Scenario: Search filters by subject eligibility

- **WHEN** an EntityPicker query filters `eligibleSubjectRoles = "primary_character"`
- **THEN** Meilisearch SHALL accept the filter
- **AND** only entities eligible for the primary character subject role SHALL be returned

### Requirement: Entity search API supports global and owner-biased queries

The API layer SHALL expose an Entity search operation backed by the `entities` index. The operation SHALL support keyword search, kind filters, verified filters, owner filters, eligible credit role filters, eligible subject role filters, and pagination. Catalog/public EntityPicker flows SHALL use global search without current-user bias. Personal EntityPicker flows MAY use an owner-biased merge where current-user entities appear before global matches.

#### Scenario: Catalog picker uses global eligibility search

- **WHEN** EntityPicker is opened from a public catalog book form for role `author`
- **THEN** it SHALL search the global `entities` index with `eligibleCreditRoles = "author"`
- **AND** it SHALL NOT rank the current user's entities above other matching entities merely because they are owned by the current user

#### Scenario: Personal picker biases owned entities

- **WHEN** EntityPicker is opened from a personal work flow
- **THEN** entities owned by the current user MAY be shown before equivalent global matches
- **AND** global matches SHALL remain available

### Requirement: Entity index sync is bounded

Entity create/update/delete operations SHALL sync the Entity's own search document, including its eligibility arrays. CreditAttribution and SubjectAttribution mutations SHALL patch the target content document's credit or subject fields, but they SHALL NOT patch Entity documents with actual-role history facets.

#### Scenario: Credit link does not patch entity role history

- **WHEN** a CreditAttribution row is created for entity E and unit U
- **THEN** the system SHALL patch U's content credit fields
- **AND** it SHALL NOT patch E with `creditRoles`, `creditUnitTypes`, or `creditCount`
- **AND** it SHALL NOT rebuild unrelated Entity documents

#### Scenario: Subject link does not patch entity role history

- **WHEN** a SubjectAttribution row is created for entity E and unit U
- **THEN** the system SHALL patch U's content subject fields
- **AND** it SHALL NOT patch E with `subjectRoles`, `subjectUnitTypes`, or `subjectCount`

#### Scenario: Entity identity change updates entity document

- **WHEN** an Entity avatar or eligibility array changes
- **THEN** the system SHALL update that Entity's `entities` index document
- **AND** it SHALL NOT synchronously fan out to every content document linked to the Entity
