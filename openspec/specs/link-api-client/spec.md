# link-api-client Specification

## Purpose
TBD - created by archiving change api-realignment. Update Purpose after archive.
## Requirements
### Requirement: Link CRUD API client
The `@rezics/api` package SHALL provide a `linkApi` object with methods that map to the server's `/links` endpoints. All types SHALL be imported from `@rezics/contract`.

Methods:
- `create(input: CreateLinkInput): Promise<LinkDTO>` — `POST /links`
- `get(unitId: string): Promise<LinkDTO>` — `GET /links/:unitId`
- `update(unitId: string, input: UpdateLinkInput): Promise<LinkDTO>` — `PUT /links/:unitId`
- `remove(unitId: string): Promise<{ message: string }>` — `DELETE /links/:unitId`

#### Scenario: Create a link
- **WHEN** `linkApi.create({ url: "https://example.com", title: "Example" })` is called
- **THEN** it SHALL send `POST /links` with the input as JSON body and return a `LinkDTO`

#### Scenario: Get a link by unitId
- **WHEN** `linkApi.get("unit-123")` is called
- **THEN** it SHALL send `GET /links/unit-123` and return a `LinkDTO`

#### Scenario: Update a link
- **WHEN** `linkApi.update("unit-123", { title: "Updated" })` is called
- **THEN** it SHALL send `PUT /links/unit-123` with the input as JSON body and return a `LinkDTO`

#### Scenario: Delete a link
- **WHEN** `linkApi.remove("unit-123")` is called
- **THEN** it SHALL send `DELETE /links/unit-123` and return `{ message: string }`

### Requirement: Link query key factory
The module SHALL export a `linkKeys` factory following the established pattern with `all`, `lists`, `list`, `details`, `detail` key builders.

#### Scenario: Key hierarchy
- **WHEN** `linkKeys.detail("unit-123")` is called
- **THEN** it SHALL return `["links", "detail", "unit-123"]`

### Requirement: Link query options
The module SHALL export query options for list and detail queries:
- `linkDetailQuery(unitId)` — fetches a single link, 10 min stale time
- Queries SHALL be disabled when the unitId is falsy.

#### Scenario: Detail query configuration
- **WHEN** `linkDetailQuery("unit-123")` is called
- **THEN** it SHALL return a `queryOptions` config with `queryKey: linkKeys.detail("unit-123")` and `queryFn` that calls `linkApi.get("unit-123")`

### Requirement: Link mutation hooks
The module SHALL export mutation hooks for create, update, and delete operations. Each mutation SHALL invalidate the relevant query keys on success.

- `useCreateLinkMutation` — invalidates list keys, sets detail cache
- `useUpdateLinkMutation` — updates detail cache, invalidates list keys
- `useDeleteLinkMutation` — removes detail cache, invalidates list keys

#### Scenario: Create mutation invalidation
- **WHEN** `useCreateLinkMutation` succeeds with a new `LinkDTO`
- **THEN** it SHALL invalidate `linkKeys.lists()` and set the detail cache for the new link's unitId

### Requirement: Link barrel export
The module SHALL export all public API surface from a `link.ts` barrel file: `linkApi`, `linkKeys`, all query options, all mutation hooks, and all re-exported types.

#### Scenario: Single import point
- **WHEN** a consumer imports from `@rezics/api/link/link`
- **THEN** they SHALL have access to `linkApi`, `linkKeys`, `linkMutations`, `linkDetailQuery`, and all link types

