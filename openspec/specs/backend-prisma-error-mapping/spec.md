## ADDED Requirements

### Requirement: Global Prisma error interception
The Elysia global `onError` handler SHALL intercept `PrismaClientKnownRequestError` instances and map them to semantically correct HTTP status codes before the response is sent.

#### Scenario: Record not found (P2025)
- **WHEN** a Prisma operation throws `PrismaClientKnownRequestError` with code `P2025`
- **THEN** the response status SHALL be `404`
- **AND** the response body SHALL include `detail.prisma.code` as `"P2025"`

#### Scenario: Unique constraint violation (P2002)
- **WHEN** a Prisma operation throws `PrismaClientKnownRequestError` with code `P2002`
- **THEN** the response status SHALL be `409`
- **AND** `detail.prisma.target` SHALL contain the constraint field names if available

#### Scenario: Foreign key constraint violation (P2003)
- **WHEN** a Prisma operation throws `PrismaClientKnownRequestError` with code `P2003`
- **THEN** the response status SHALL be `400`

#### Scenario: Required relation violation (P2014)
- **WHEN** a Prisma operation throws `PrismaClientKnownRequestError` with code `P2014`
- **THEN** the response status SHALL be `400`

#### Scenario: Unmapped Prisma error code
- **WHEN** a Prisma operation throws `PrismaClientKnownRequestError` with an unmapped code
- **THEN** the response status SHALL be `500`
- **AND** `detail.prisma.code` SHALL still be included for debugging

### Requirement: Structured error response shape
All error responses SHALL follow a consistent JSON shape: `{ status, code, message, detail? }`. The `detail` field is optional and present only when structured metadata is available.

#### Scenario: Prisma error includes detail
- **WHEN** a Prisma error is intercepted
- **THEN** the response SHALL include `detail.prisma` with at least `code` and, when available, `model` and `operation`

#### Scenario: Non-Prisma error omits detail
- **WHEN** an `AppError` or unknown error is handled
- **THEN** the response SHALL NOT include a `detail` field

### Requirement: No sensitive data in error responses
Error responses SHALL NOT include raw SQL queries, where-clause values, database connection strings, or stack traces.

#### Scenario: Prisma error with query metadata
- **WHEN** a `PrismaClientKnownRequestError` contains internal query details in its `message`
- **THEN** the response `message` SHALL be a sanitized human-readable string (e.g., "Book not found") rather than the raw Prisma message

### Requirement: Remove manual P2025 handling
Existing manual `P2025` catch blocks (e.g., in `jwt.admin.api.ts`) SHALL be removed in favor of the global handler.

#### Scenario: JWT admin API not-found error
- **WHEN** a JWT service record is not found
- **THEN** the global handler SHALL produce the same 404 response previously handled by the manual catch block
