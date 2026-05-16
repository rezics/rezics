## MODIFIED Requirements

### Requirement: System shelf id resolution on the client

The client SHALL resolve the four system shelf unit ids (`favorites`, `backlog`, `active`, `completed`) for the current user through the standard SlugRef path provided by `slug-ref` and `typed-slug-lookup`. For each system `kindKey`, the resolution SHALL be expressed as `useSlugRef({ scope: viewer.unitId, slug: kindKey })` (or an equivalent `GET /shelf/by-slug/:userSlug/:slug` typed call), returning the `Unit.id` of the corresponding `SHELF` Unit. The user DTO (`/user/me` and related responses) SHALL NOT carry a `systemShelves` map; the SlugRef cache is the canonical client-side resolution store.

#### Scenario: Client resolves a system shelf id via SlugRef

- **WHEN** the client needs the unit id of the viewer's `backlog` shelf
- **THEN** the client SHALL issue `useSlugRef({ scope: viewer.unitId, slug: 'backlog' })`
- **AND** the resolved id SHALL come from the standard SlugRef query cache shared with every other slug-bearing Unit

#### Scenario: System shelf id resolution survives across the session

- **WHEN** the client resolves a system shelf id once during a session
- **THEN** subsequent reads SHALL be served from the SlugRef cache without re-issuing a network request
- **AND** invalidation SHALL follow the SlugRef cache's own rules, not a system-shelf-specific TTL

#### Scenario: Resolution of a missing system shelf is unreachable in practice

- **WHEN** the client attempts to resolve a system shelf for a user whose registration completed successfully
- **THEN** the slug SHALL always resolve to a `Unit.id` because the four system shelves are minted in the same transaction as the user
- **AND** the client SHALL NOT carry any "lazy create" branch for system shelves
