# pagination-limit-contract Specification

## Purpose

Defines the shared `paginationLimitSchema` exported from
`@rezics/contract/pagination.ts` (`minimum: 1`, `maximum: 100`,
`default: 20`) and the rule that every list query schema
(`bookListQuerySchema`, `postListQuerySchema`,
`realmListQuerySchema`, `shelfListQuerySchema`,
`chapterListQuerySchema`, `tagListQuerySchema`,
`feedbackListQuerySchema`, `userFilterSchema`) uses it for its
`limit` field instead of bare `t.Number()` or `t.Numeric()`.

## Requirements

### Requirement: Shared pagination limit schema
The `@rezics/contract` package SHALL export a reusable `paginationLimitSchema` Typebox schema from `pagination.ts` with `minimum: 1`, `maximum: 100`, and `default: 20`.

#### Scenario: Schema defines constraints
- **WHEN** a developer imports `paginationLimitSchema` from `@rezics/contract`
- **THEN** the schema enforces `minimum: 1`, `maximum: 100`, and defaults to `20` when omitted

### Requirement: All list query schemas use shared pagination limit
All list query schemas (`bookListQuerySchema`, `postListQuerySchema`, `realmListQuerySchema`, `shelfListQuerySchema`, `chapterListQuerySchema`, `tagListQuerySchema`, `feedbackListQuerySchema`, `userFilterSchema`) SHALL use `paginationLimitSchema` for their `limit` field instead of bare `t.Number()` or `t.Numeric()`.

#### Scenario: Request exceeds maximum limit
- **WHEN** a caller sends `GET /books/?limit=500`
- **THEN** Elysia rejects the request with a validation error before reaching the service layer

#### Scenario: Request omits limit
- **WHEN** a caller sends `GET /books/` without a `limit` parameter
- **THEN** the system uses the default value of 20

#### Scenario: Request with valid limit
- **WHEN** a caller sends `GET /books/?limit=50`
- **THEN** the system accepts and uses limit=50
