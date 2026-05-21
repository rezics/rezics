## ADDED Requirements

### Requirement: Entities index document
The system SHALL maintain a dedicated Meilisearch index named `entities` whose primary key is `id` and whose document represents searchable Entity identity. The document SHALL include `id`, `unitId`, `kind`, `verified`, `slug`, `ownerUnitId`, `avatar`, `titles`, `summaries`, `translations`, `creditRoles`, `creditUnitTypes`, `subjectRoles`, `subjectUnitTypes`, `creditCount`, `subjectCount`, `createdAt`, and `updatedAt`.

#### Scenario: Entity document contains identity and avatar
- **WHEN** an Entity with `avatar = "https://cdn.example/liu.png"` and translated titles is synced
- **THEN** the `entities` document SHALL include the same avatar URL
- **AND** the document SHALL include all translated titles in `titles`
- **AND** the document SHALL include structured translations for result rendering

#### Scenario: Entity document contains role facets
- **WHEN** an Entity is credited as `author` on a BOOK and linked as `primary_character` on a POST
- **THEN** the `entities` document SHALL include `"author"` in `creditRoles`
- **AND** it SHALL include `"BOOK"` in `creditUnitTypes`
- **AND** it SHALL include `"primary_character"` in `subjectRoles`
- **AND** it SHALL include `"POST"` in `subjectUnitTypes`

### Requirement: Entities index does not store related Unit id arrays
The `entities` index SHALL NOT store arrays of Units related to the Entity, including `creditedUnitIds` or `subjectUnitIds`. Entity work/subject detail pages SHALL load related Units through attribution/content APIs rather than from the entity search document.

#### Scenario: Related Unit ids are excluded
- **WHEN** an Entity is linked to many Units through CreditAttribution and SubjectAttribution
- **THEN** the `entities` document SHALL expose role/type facets and counts
- **AND** it SHALL NOT contain `creditedUnitIds`
- **AND** it SHALL NOT contain `subjectUnitIds`

### Requirement: Entities index settings support identity search and facets
The search client SHALL configure the `entities` index with searchable identity fields and filterable registry-backed facets. Searchable attributes SHALL include at least `titles`, `summaries`, and `slug`. Filterable attributes SHALL include `kind`, `verified`, `ownerUnitId`, `creditRoles`, `creditUnitTypes`, `subjectRoles`, and `subjectUnitTypes`. Sortable attributes SHALL include `createdAt` and `updatedAt`.

#### Scenario: Search filters by credit role
- **WHEN** an EntityPicker query filters `creditRoles = "author"`
- **THEN** Meilisearch SHALL accept the filter
- **AND** only entities with author credit facets SHALL be returned

### Requirement: Entity search API supports global and owner-biased queries
The API layer SHALL expose an Entity search operation backed by the `entities` index. The operation SHALL support keyword search, kind filters, verified filters, owner filters, credit role filters, subject role filters, and pagination. Catalog/public EntityPicker flows SHALL use global search without current-user bias. Personal EntityPicker flows MAY use an owner-biased merge where current-user entities appear before global matches.

#### Scenario: Catalog picker uses global search
- **WHEN** EntityPicker is opened from a public catalog book form for role `author`
- **THEN** it SHALL search the global `entities` index
- **AND** it SHALL NOT rank the current user's entities above other matching entities merely because they are owned by the current user

#### Scenario: Personal picker biases owned entities
- **WHEN** EntityPicker is opened from a personal work flow
- **THEN** entities owned by the current user MAY be shown before equivalent global matches
- **AND** global matches SHALL remain available

### Requirement: Entity index sync is bounded
Entity create/update/delete operations SHALL sync the Entity's own search document. CreditAttribution mutations SHALL patch only the affected Entity's credit facets and the target content document's credit fields. SubjectAttribution mutations SHALL patch only the affected Entity's subject facets and the target content document's subject fields.

#### Scenario: Credit link patches entity facets
- **WHEN** a CreditAttribution row is created for entity E and unit U
- **THEN** the system SHALL patch E's `creditRoles`, `creditUnitTypes`, and `creditCount`
- **AND** it SHALL patch U's content credit fields
- **AND** it SHALL NOT rebuild unrelated Entity documents

#### Scenario: Entity identity change updates entity document
- **WHEN** an Entity avatar changes
- **THEN** the system SHALL update that Entity's `entities` index document
- **AND** it SHALL NOT synchronously fan out to every content document linked to the Entity
