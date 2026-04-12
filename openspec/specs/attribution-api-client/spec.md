# attribution-api-client Specification

## Purpose
TBD - created by archiving change api-realignment. Update Purpose after archive.
## Requirements
### Requirement: Person API client methods
The `@rezics/api` package SHALL provide an `attributionApi` object with person methods that map to the server's `/attribution/persons` endpoints. All types SHALL be imported from `@rezics/contract`.

Methods:
- `listPersons(query?: PersonListQuery): Promise<{ persons: PersonDTO[]; total: number }>` — `GET /attribution/persons`
- `getPerson(id: string): Promise<PersonDTO>` — `GET /attribution/persons/:id`
- `createPerson(input: CreatePersonInput): Promise<PersonDTO>` — `POST /attribution/persons`
- `updatePerson(id: string, input: UpdatePersonInput): Promise<PersonDTO>` — `PUT /attribution/persons/:id`
- `deletePerson(id: string): Promise<{ message: string }>` — `DELETE /attribution/persons/:id`

#### Scenario: List persons with pagination
- **WHEN** `attributionApi.listPersons({ page: 1, limit: 20 })` is called
- **THEN** it SHALL send `GET /attribution/persons?page=1&limit=20` and return `{ persons: PersonDTO[], total: number }`

#### Scenario: Get a single person
- **WHEN** `attributionApi.getPerson("person-1")` is called
- **THEN** it SHALL send `GET /attribution/persons/person-1` and return a `PersonDTO`

### Requirement: Organization API client methods
The `attributionApi` object SHALL include organization methods that map to `/attribution/organizations`.

Methods:
- `listOrganizations(query?: OrganizationListQuery): Promise<{ organizations: OrganizationDTO[]; total: number }>` — `GET /attribution/organizations`
- `getOrganization(id: string): Promise<OrganizationDTO>` — `GET /attribution/organizations/:id`
- `createOrganization(input: CreateOrganizationInput): Promise<OrganizationDTO>` — `POST /attribution/organizations`
- `updateOrganization(id: string, input: UpdateOrganizationInput): Promise<OrganizationDTO>` — `PUT /attribution/organizations/:id`
- `deleteOrganization(id: string): Promise<{ message: string }>` — `DELETE /attribution/organizations/:id`

#### Scenario: List organizations
- **WHEN** `attributionApi.listOrganizations()` is called
- **THEN** it SHALL send `GET /attribution/organizations` and return `{ organizations: OrganizationDTO[], total: number }`

### Requirement: Credit link API client methods
The `attributionApi` object SHALL include credit management methods that map to `/attribution/credits`.

Methods:
- `linkPersonCredit(input: LinkPersonCreditInput): Promise<PersonCreditDTO>` — `POST /attribution/credits/person`
- `unlinkPersonCredit(unitId, personId, roleKey): Promise<{ message: string }>` — `DELETE /attribution/credits/person/:unitId/:personId/:roleKey`
- `linkOrgCredit(input: LinkOrgCreditInput): Promise<OrgCreditDTO>` — `POST /attribution/credits/organization`
- `unlinkOrgCredit(unitId, organizationId, roleKey): Promise<{ message: string }>` — `DELETE /attribution/credits/organization/:unitId/:organizationId/:roleKey`

#### Scenario: Link a person credit
- **WHEN** `attributionApi.linkPersonCredit({ unitId: "u1", personId: "p1", roleKey: "author" })` is called
- **THEN** it SHALL send `POST /attribution/credits/person` with JSON body and return a `PersonCreditDTO`

#### Scenario: Unlink a person credit
- **WHEN** `attributionApi.unlinkPersonCredit("u1", "p1", "author")` is called
- **THEN** it SHALL send `DELETE /attribution/credits/person/u1/p1/author` and return `{ message: string }`

### Requirement: Attribution query key factory
The module SHALL export an `attributionKeys` factory with keys for:
- Person list/detail queries
- Organization list/detail queries
- Credits by unit queries

#### Scenario: Person detail key
- **WHEN** `attributionKeys.personDetail("person-1")` is called
- **THEN** it SHALL return `["attribution", "persons", "detail", "person-1"]`

#### Scenario: Credits by unit key
- **WHEN** `attributionKeys.creditsByUnit("unit-1")` is called
- **THEN** it SHALL return `["attribution", "credits", "unit-1"]`

### Requirement: Attribution query options
The module SHALL export query options for:
- `personListQuery(query?)` — 5 min stale
- `personDetailQuery(id)` — 10 min stale
- `organizationListQuery(query?)` — 5 min stale
- `organizationDetailQuery(id)` — 10 min stale

#### Scenario: Person list query
- **WHEN** `personListQuery({ q: "search" })` is called
- **THEN** it SHALL return a `queryOptions` config using `attributionKeys.personList(query)` and `attributionApi.listPersons(query)`

### Requirement: Attribution mutation hooks
The module SHALL export mutation hooks for all write operations. Each SHALL invalidate relevant caches on success.

Person mutations:
- `useCreatePersonMutation` — invalidates person lists
- `useUpdatePersonMutation` — updates person detail, invalidates lists
- `useDeletePersonMutation` — removes person detail, invalidates lists

Organization mutations:
- `useCreateOrganizationMutation` — invalidates organization lists
- `useUpdateOrganizationMutation` — updates organization detail, invalidates lists
- `useDeleteOrganizationMutation` — removes organization detail, invalidates lists

Credit mutations:
- `useLinkPersonCreditMutation` — invalidates credits-by-unit
- `useUnlinkPersonCreditMutation` — invalidates credits-by-unit
- `useLinkOrgCreditMutation` — invalidates credits-by-unit
- `useUnlinkOrgCreditMutation` — invalidates credits-by-unit

#### Scenario: Create person invalidation
- **WHEN** `useCreatePersonMutation` succeeds
- **THEN** it SHALL invalidate `attributionKeys.personLists()` and set the detail cache for the new person

#### Scenario: Link credit invalidation
- **WHEN** `useLinkPersonCreditMutation` succeeds with `{ unitId: "u1" }`
- **THEN** it SHALL invalidate `attributionKeys.creditsByUnit("u1")`

### Requirement: Attribution barrel export
The module SHALL export all public API surface from an `attribution.ts` barrel file.

#### Scenario: Single import point
- **WHEN** a consumer imports from `@rezics/api/attribution/attribution`
- **THEN** they SHALL have access to `attributionApi`, `attributionKeys`, `attributionMutations`, all query options, and all re-exported types

