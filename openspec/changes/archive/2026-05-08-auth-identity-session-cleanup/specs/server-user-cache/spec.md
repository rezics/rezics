## ADDED Requirements

### Requirement: User lookups key on userId

Any direct `User` lookups in server code (Prisma queries, mappers, helpers) SHALL key on `userId` as the primary key field. The legacy column name `unitId` on the `User` table SHALL NOT be referenced — both because the column has been renamed and because the misnomer would conflate user identity with content (`Unit`) identity.

#### Scenario: Direct user lookup uses userId

- **WHEN** any server code reads a single `User` by primary key
- **THEN** the Prisma query SHALL be `prisma.user.findUnique({ where: { userId } })`
- **AND** the field name `unitId` SHALL NOT appear in any user-table query

#### Scenario: User mapper exposes userId on DTOs

- **WHEN** the user mapper produces a DTO
- **THEN** the DTO SHALL contain a `userId` field
- **AND** it SHALL NOT contain a `unitId` field for user-shaped responses

### Requirement: No in-memory user cache exists

The server SHALL NOT maintain an in-memory `Map`-style user cache for permission resolution or DTO hydration. Permission is resolved via `rezics-session-token` claims (fast path) and verified against the database for privileged operations (slow path). The legacy `package/server/src/middleware/user-cache.ts` SHALL NOT exist.

#### Scenario: Permission resolution skips cache

- **WHEN** the request middleware needs the actor's role for a fast-path denial
- **THEN** it reads `permission.role` from the validated `rezics-session-token` claims
- **AND** it SHALL NOT consult any in-memory cache

#### Scenario: Privileged endpoint verifies against DB

- **WHEN** an admin- or root-only endpoint authorizes a request
- **THEN** it queries `User.permission` from the database by `userId`
- **AND** it SHALL NOT short-circuit on a cached value
