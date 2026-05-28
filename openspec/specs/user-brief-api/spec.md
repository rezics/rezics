# user-brief-api Specification

## Purpose

Defines the lightweight `UserBrief` surface: the
`GET /user/brief/:userId` single read and the `POST /user/brief`
batch (silently omitting unknown ids), the Typebox `UserBrief`
schema in `@rezics/contract` (`userId`, `name`, `slug`, optional
`bio` and `avatar`, no `unitId`), and the requirement that the
endpoint's Prisma query selects only the returned fields without
joining related tables.

## Requirements

### Requirement: Single user brief endpoint
The server SHALL provide a `GET /user/brief/:userId` endpoint that returns a lightweight user object containing only `name`, `slug`, `bio`, and `avatar`. The path parameter SHALL be named `userId` (not `unitId`).

#### Scenario: Fetch brief by userId
- **WHEN** a client sends `GET /user/brief/{userId}` with a valid userId
- **THEN** the server responds with `{ name, slug, bio, avatar }` for that user

#### Scenario: User not found
- **WHEN** a client sends `GET /user/brief/{userId}` with a non-existent userId
- **THEN** the server responds with a 404 error

### Requirement: Batch user brief endpoint
The server SHALL provide a `POST /user/brief` endpoint that accepts `{ userIds: string[] }` and returns an array of brief user objects keyed by `userId`.

#### Scenario: Fetch multiple users
- **WHEN** a client sends `POST /user/brief` with `{ userIds: ["id1", "id2", "id3"] }`
- **THEN** the server responds with an array of `{ userId, name, slug, bio, avatar }` for each found user

#### Scenario: Some users not found in batch
- **WHEN** a client sends a batch request where some userIds do not exist
- **THEN** the response includes only the found users — missing userIds are silently omitted

### Requirement: UserBrief contract schema
A `UserBrief` Typebox schema SHALL be defined in `@rezics/contract` containing exactly: `userId`, `name`, `slug`, `bio` (optional), and `avatar` (optional). The field name `unitId` SHALL NOT appear on user-shaped contracts.

#### Scenario: Schema is importable
- **WHEN** a consumer imports `UserBrief` from `@rezics/contract`
- **THEN** it provides a Typebox schema with the specified fields, including `userId`

### Requirement: Lightweight query
The brief endpoint SHALL query only the fields it returns (name, slug, bio, avatar) plus the `userId` primary key from the database — it SHALL NOT load the full user record or join related tables.

#### Scenario: Database efficiency
- **WHEN** the brief endpoint is called
- **THEN** the Prisma query uses `select` to fetch only `userId`, `name`, `slug`, `bio`, `avatar`
