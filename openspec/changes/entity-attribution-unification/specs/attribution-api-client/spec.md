## REMOVED Requirements

### Requirement: Person API client methods
**Reason**: Replaced by unified Entity API client methods. Person-specific endpoints no longer exist.
**Migration**: Use `attributionApi.listEntities({ kind: "person" })` instead of `attributionApi.listPersons()`.

### Requirement: Organization API client methods
**Reason**: Replaced by unified Entity API client methods. Organization-specific endpoints no longer exist.
**Migration**: Use `attributionApi.listEntities({ kind: "organization" })` instead of `attributionApi.listOrganizations()`.

### Requirement: Credit link API client methods
**Reason**: Replaced by unified attribution link/unlink methods. Separate person/org credit endpoints no longer exist.
**Migration**: Use `attributionApi.linkAttribution({ unitId, entityId, role })` instead of `attributionApi.linkPersonCredit(...)` or `attributionApi.linkOrgCredit(...)`.

### Requirement: Attribution query key factory
**Reason**: Replaced by a new key factory with entity-based keys instead of person/org-based keys.
**Migration**: Use `attributionKeys.entityList(query)` instead of `attributionKeys.personList(query)`.

### Requirement: Attribution query options
**Reason**: Replaced by unified entity query options.
**Migration**: Use `entityListQuery({ kind: "person" })` instead of `personListQuery()`.

### Requirement: Attribution mutation hooks
**Reason**: Replaced by unified entity and attribution mutation hooks.
**Migration**: Use `useCreateEntityMutation` instead of `useCreatePersonMutation` / `useCreateOrganizationMutation`.

### Requirement: Attribution barrel export
**Reason**: Barrel export is rebuilt with unified API surface.
**Migration**: Import from the same path — API names change from person/org-specific to entity-unified.

## ADDED Requirements

### Requirement: Entity API client methods

The `attributionApi` object SHALL provide entity methods that map to the server's `/attribution/entities` endpoints. All types SHALL be imported from `@rezics/contract`.

Methods:
- `listEntities(query?: EntityListQuery): Promise<{ entities: EntityDTO[]; total: number }>` — `GET /attribution/entities`
- `getEntity(id: string): Promise<EntityDTO>` — `GET /attribution/entities/:id`
- `createEntity(input: CreateEntityInput): Promise<EntityDTO>` — `POST /attribution/entities`
- `updateEntity(id: string, input: UpdateEntityInput): Promise<EntityDTO>` — `PUT /attribution/entities/:id`
- `deleteEntity(id: string): Promise<{ message: string }>` — `DELETE /attribution/entities/:id`

#### Scenario: List entities filtered by kind

- **WHEN** `attributionApi.listEntities({ kind: "person", page: 1, limit: 20 })` is called
- **THEN** it SHALL send `GET /attribution/entities?kind=person&page=1&limit=20` and return `{ entities: EntityDTO[], total: number }`

#### Scenario: Get a single entity

- **WHEN** `attributionApi.getEntity("entity-1")` is called
- **THEN** it SHALL send `GET /attribution/entities/entity-1` and return an `EntityDTO` with translations

### Requirement: Unified attribution link API client methods

The `attributionApi` object SHALL include unified credit management methods:
- `linkAttribution(input: LinkAttributionInput): Promise<AttributionDTO>` — `POST /attribution/credits`
- `unlinkAttribution(unitId, entityId, role): Promise<{ message: string }>` — `DELETE /attribution/credits/:unitId/:entityId/:role`

#### Scenario: Link an attribution

- **WHEN** `attributionApi.linkAttribution({ unitId: "u1", entityId: "e1", role: "author" })` is called
- **THEN** it SHALL send `POST /attribution/credits` with JSON body and return an `AttributionDTO`

#### Scenario: Unlink an attribution

- **WHEN** `attributionApi.unlinkAttribution("u1", "e1", "author")` is called
- **THEN** it SHALL send `DELETE /attribution/credits/u1/e1/author` and return `{ message: string }`

### Requirement: Entity query key factory

The module SHALL export an `attributionKeys` factory with keys for:
- Entity list/detail queries (with kind filter support)
- Attributions by unit queries

#### Scenario: Entity list key with kind filter

- **WHEN** `attributionKeys.entityList({ kind: "person" })` is called
- **THEN** it SHALL return `["attribution", "entities", "list", { kind: "person" }]`

#### Scenario: Entity detail key

- **WHEN** `attributionKeys.entityDetail("entity-1")` is called
- **THEN** it SHALL return `["attribution", "entities", "detail", "entity-1"]`

#### Scenario: Attributions by unit key

- **WHEN** `attributionKeys.attributionsByUnit("unit-1")` is called
- **THEN** it SHALL return `["attribution", "credits", "unit-1"]`

### Requirement: Entity query options

The module SHALL export query options:
- `entityListQuery(query?)` — 5 min stale
- `entityDetailQuery(id)` — 10 min stale

#### Scenario: Entity list query with kind

- **WHEN** `entityListQuery({ kind: "person", q: "liu" })` is called
- **THEN** it SHALL return a `queryOptions` config using `attributionKeys.entityList(query)` and `attributionApi.listEntities(query)`

### Requirement: Entity and attribution mutation hooks

The module SHALL export mutation hooks for all write operations with cache invalidation:

Entity mutations:
- `useCreateEntityMutation` — invalidates entity lists
- `useUpdateEntityMutation` — updates entity detail, invalidates lists
- `useDeleteEntityMutation` — removes entity detail, invalidates lists

Attribution mutations:
- `useLinkAttributionMutation` — invalidates attributions-by-unit
- `useUnlinkAttributionMutation` — invalidates attributions-by-unit

#### Scenario: Create entity invalidation

- **WHEN** `useCreateEntityMutation` succeeds
- **THEN** it SHALL invalidate `attributionKeys.entityLists()` and set the detail cache for the new entity

#### Scenario: Link attribution invalidation

- **WHEN** `useLinkAttributionMutation` succeeds with `{ unitId: "u1" }`
- **THEN** it SHALL invalidate `attributionKeys.attributionsByUnit("u1")`

### Requirement: Attribution barrel export

The module SHALL export all public API surface from an `attribution.ts` barrel file.

#### Scenario: Single import point

- **WHEN** a consumer imports from `@rezics/api/attribution/attribution`
- **THEN** they SHALL have access to `attributionApi`, `attributionKeys`, all query options, all mutation hooks, and all re-exported types
