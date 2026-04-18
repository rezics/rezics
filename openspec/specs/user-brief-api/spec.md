## ADDED Requirements

### Requirement: Single user brief endpoint
The server SHALL provide a `GET /user/brief/:unitId` endpoint that returns a lightweight user object containing only `name`, `slug`, `bio`, and `avatar`.

#### Scenario: Fetch brief by unitId
- **WHEN** a client sends `GET /user/brief/{unitId}` with a valid unitId
- **THEN** the server responds with `{ name, slug, bio, avatar }` for that user

#### Scenario: User not found
- **WHEN** a client sends `GET /user/brief/{unitId}` with a non-existent unitId
- **THEN** the server responds with a 404 error

### Requirement: Batch user brief endpoint
The server SHALL provide a `POST /user/brief` endpoint that accepts `{ unitIds: string[] }` and returns an array of brief user objects.

#### Scenario: Fetch multiple users
- **WHEN** a client sends `POST /user/brief` with `{ unitIds: ["id1", "id2", "id3"] }`
- **THEN** the server responds with an array of `{ unitId, name, slug, bio, avatar }` for each found user

#### Scenario: Some users not found in batch
- **WHEN** a client sends a batch request where some unitIds do not exist
- **THEN** the response includes only the found users — missing unitIds are silently omitted

### Requirement: UserBrief contract schema
A `UserBrief` Typebox schema SHALL be defined in `@rezics/contract` containing exactly: `unitId`, `name`, `slug`, `bio` (optional), and `avatar` (optional).

#### Scenario: Schema is importable
- **WHEN** a consumer imports `UserBrief` from `@rezics/contract`
- **THEN** it provides a Typebox schema with the specified fields

### Requirement: Lightweight query
The brief endpoint SHALL query only the fields it returns (name, slug, bio, avatar) from the database — it SHALL NOT load the full user record or join related tables.

#### Scenario: Database efficiency
- **WHEN** the brief endpoint is called
- **THEN** the Prisma query uses `select` to fetch only `unitId`, `name`, `slug`, `bio`, `avatar`
